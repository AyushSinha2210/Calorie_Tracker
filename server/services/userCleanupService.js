import admin from "firebase-admin";
import cron from "node-cron";

const INACTIVITY_DAYS = 60;

/**
 * Initialize Firebase Admin SDK.
 * Expects FIREBASE_SERVICE_ACCOUNT env var to contain the JSON string of the
 * service-account key, OR a path to the key file via GOOGLE_APPLICATION_CREDENTIALS.
 */
function initAdmin() {
  if (admin.apps.length) return; // already initialised

  const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (sa) {
    const credential = admin.credential.cert(JSON.parse(sa));
    admin.initializeApp({ credential });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS env var (file path)
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
}

/**
 * Delete all documents in a sub-collection (Firestore has no recursive delete
 * in the client SDK, so we batch-delete manually).
 */
async function deleteSubcollection(parentRef, subcollectionName) {
  const db = admin.firestore();
  const colRef = db.collection(`${parentRef.path}/${subcollectionName}`);
  const batchSize = 100;

  let snap = await colRef.limit(batchSize).get();
  while (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    snap = await colRef.limit(batchSize).get();
  }
}

/**
 * Find and delete users who have been inactive for more than INACTIVITY_DAYS.
 * Returns the number of deleted users.
 */
export async function deleteInactiveUsers() {
  initAdmin();

  const db = admin.firestore();
  const authAdmin = admin.auth();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INACTIVITY_DAYS);

  const usersRef = db.collection("users");
  const snapshot = await usersRef.where("lastActive", "<", cutoff).get();

  if (snapshot.empty) {
    console.log("[Cleanup] No inactive users found.");
    return 0;
  }

  let deleted = 0;
  for (const userDoc of snapshot.docs) {
    const uid = userDoc.id;
    try {
      // 1. Delete sub-collections (foodLogs, etc.)
      await deleteSubcollection(userDoc.ref, "foodLogs");

      // 2. Delete the user document from Firestore
      await userDoc.ref.delete();

      // 3. Delete the user from Firebase Authentication
      await authAdmin.deleteUser(uid);

      deleted++;
      console.log(`[Cleanup] Deleted user ${uid}`);
    } catch (err) {
      console.error(`[Cleanup] Failed to delete user ${uid}:`, err.message);
    }
  }

  console.log(`[Cleanup] Finished. Deleted ${deleted} inactive user(s).`);
  return deleted;
}

/**
 * Schedule the cleanup job to run every day at 2:00 AM server time.
 */
export function scheduleUserCleanup() {
  initAdmin();
  cron.schedule("0 2 * * *", async () => {
    console.log("[Cleanup] Running scheduled inactive-user cleanup…");
    try {
      await deleteInactiveUsers();
    } catch (err) {
      console.error("[Cleanup] Scheduled job error:", err.message);
    }
  });
  console.log("[Cleanup] Scheduled daily inactive-user cleanup at 02:00 AM.");
}
