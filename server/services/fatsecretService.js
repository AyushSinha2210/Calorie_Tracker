import { getCached, setCache } from "../utils/nutritionCache.js";

export async function lookupUSDA(foodName, grams) {
  const cacheKey = `usda:${foodName.toLowerCase()}:${grams}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const searchRes = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=5&api_key=DEMO_KEY`);
  if (!searchRes.ok) throw new Error(`USDA API error: ${searchRes.status}`);
  const { foods } = await searchRes.json();
  if (!foods?.length) throw new Error(`No USDA results for "${foodName}"`);

  const nutrients = foods[0].foodNutrients || [];
  const cal = nutrients.find(n => n.nutrientName === 'Energy' && n.unitName === 'KCAL')?.value || 0;
  const pro = nutrients.find(n => n.nutrientName === 'Protein')?.value || 0;
  const f = grams / 100;

  const result = { name: foods[0].description, grams, calories: Math.round(cal * f), protein: Math.round(pro * f * 10) / 10, source: 'usda' };
  setCache(cacheKey, result);
  return result;
}

export async function lookupFatSecret(foodName, grams) {
  const cacheKey = `fatsecret:${foodName.toLowerCase()}:${grams}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const tokenRes = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${process.env.FATSECRET_CLIENT_ID}&client_secret=${process.env.FATSECRET_CLIENT_SECRET}`
  });
  const { access_token } = await tokenRes.json();
  if (!access_token) throw new Error('FatSecret auth failed');
  const headers = { 'Authorization': `Bearer ${access_token}` };

  const searchData = await (await fetch(`https://platform.fatsecret.com/rest/server.api?method=foods.search&search_expression=${encodeURIComponent(foodName)}&format=json&max_results=3`, { headers })).json();
  if (searchData.error) throw new Error(searchData.error.message);
  if (!searchData.foods?.food?.length) throw new Error(`No FatSecret results for "${foodName}"`);

  const firstFood = Array.isArray(searchData.foods.food) ? searchData.foods.food[0] : searchData.foods.food;
  const detailData = await (await fetch(`https://platform.fatsecret.com/rest/server.api?method=food.get.v2&food_id=${firstFood.food_id}&format=json`, { headers })).json();
  if (detailData.error) throw new Error(detailData.error.message);

  const servings = detailData.food.servings.serving;
  const servingList = Array.isArray(servings) ? servings : [servings];
  const serving = servingList.find(s => parseFloat(s.metric_serving_amount) === 100) || servingList[0];
  const f = grams / (parseFloat(serving.metric_serving_amount) || 100);

  const result = { name: detailData.food.food_name, grams, calories: Math.round((parseFloat(serving.calories) || 0) * f), protein: Math.round((parseFloat(serving.protein) || 0) * f * 10) / 10, source: 'fatsecret' };
  setCache(cacheKey, result);
  return result;
}

export async function getNutrition(foodName, grams) {
  try { return await lookupUSDA(foodName, grams); } catch (e) { console.log(`USDA failed: ${e.message}`); }
  try { return await lookupFatSecret(foodName, grams); } catch (e) { console.log(`FatSecret failed: ${e.message}`); }
  return null;
}
