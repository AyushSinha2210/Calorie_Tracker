/* global globalThis */
import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ThemeProvider } from './context/ThemeContext';
import Login from './Pages/Login';
import Register from './Pages/Register';
import VerifyEmail from './Pages/VerifyEmail';
import ForgotPassword from './Pages/ForgotPassword';
import Dashboard from './Pages/Dashboard';
import ProfileSetup from './Pages/ProfileSetup';
import Profile from './Pages/Profile';
import ProtectedRoute from './components/ProtectedRoute';

/* ─── Animation helpers ───────────────────────────────────────── */
const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.1 } } };
const fadeUp   = { hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } } };
const scaleUp  = { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } } };
const slideIn  = (dir = 'left') => ({
  hidden: { opacity: 0, x: dir === 'left' ? -40 : 40 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
});

const FEATURES = [
  { icon: '📸', title: 'AI Food Recognition',  desc: 'Snap a photo or describe your meal — AI identifies every item and logs calories, protein & macros instantly.' },
  { icon: '🤖', title: 'Personal AI Coach',     desc: 'Get real-time feedback on every meal and workout from an LLM that knows your goals, body stats & history.' },
  { icon: '🏋️', title: 'Smart Workout Tracker', desc: 'Search 800+ exercises, log sets & reps, track calories burned — all synced with your nutrition data.' },
  { icon: '📊', title: 'Deep Analytics',         desc: 'Beautiful charts, monthly breakdowns, weight trends & deficit tracking to visualize your transformation.' },
];

const HOW_IT_WORKS = [
  { num: '01', title: 'Create your profile',  desc: 'Enter your age, weight, height, and calorie goal. FoodCal calculates your maintenance and targets.' },
  { num: '02', title: 'Log meals effortlessly', desc: 'Type, speak, or snap a photo. Our AI parses ingredients, portions, and nutrition — no manual entry.' },
  { num: '03', title: 'Get coached daily',     desc: 'AI Coach reacts to every log with personalized tips, motivation, or tough love in your chosen tone.' },
  { num: '04', title: 'Track & transform',     desc: 'Watch your charts evolve, hit your targets, and receive weekly email reports on your progress.' },
];

const SEO_KEYWORDS = [
  'AI calorie tracker',
  'workout coach',
  'nutrition log',
  'meal logging',
  'protein tracking',
  'fitness goals',
];

/* ─── Fake dashboard mockup for hero ───────────────────────────── */
const DashboardMockup = () => (
  <div className="select-none pointer-events-none w-full max-w-3xl mx-auto">
    <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 shadow-2xl shadow-surface-900/10 dark:shadow-black/30 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-50 dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 text-center text-[11px] text-surface-400 dark:text-surface-500 font-medium">FoodCal — Dashboard</div>
      </div>
      {/* Fake nav */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-surface-100 dark:border-surface-800">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded bg-brand-600 flex items-center justify-center text-white text-[7px] font-bold">FC</div>
          <span className="text-xs font-semibold text-surface-900 dark:text-surface-100">Dashboard</span>
        </div>
        <div className="flex gap-3 ml-auto">
          {['Nutrition', 'Workout', 'Weight', 'AI Coach'].map((t,i) => (
            <span key={t} className={`text-[10px] font-medium pb-1 ${i === 0 ? 'text-surface-900 dark:text-surface-100 border-b border-brand-500' : 'text-surface-400 dark:text-surface-500'}`}>{t}</span>
          ))}
        </div>
      </div>
      {/* Fake stat cards */}
      <div className="p-5">
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Consumed', value: '1,847', unit: 'kcal', color: 'text-surface-900 dark:text-surface-100' },
            { label: 'Protein', value: '124', unit: 'g', color: 'text-surface-900 dark:text-surface-100' },
            { label: 'Burned', value: '420', unit: 'kcal', color: 'text-surface-900 dark:text-surface-100' },
            { label: 'Deficit', value: '573', unit: 'kcal', color: 'text-brand-600 dark:text-brand-400' },
          ].map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 + i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-lg border border-surface-200 dark:border-surface-700 p-3 bg-white dark:bg-surface-800/50"
            >
              <div className="text-[9px] font-medium text-surface-400 dark:text-surface-500 uppercase tracking-wider mb-1">{s.label}</div>
              <div className={`text-lg font-bold tracking-tight ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-surface-400 dark:text-surface-500">{s.unit}</div>
            </motion.div>
          ))}
        </div>
        {/* Fake chart */}
        <motion.div
          initial={{ opacity: 0, scaleY: 0.5 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 1.3, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="origin-bottom"
        >
          <div className="rounded-lg border border-surface-200 dark:border-surface-700 p-4 bg-white dark:bg-surface-800/50">
            <div className="text-[10px] font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">Weekly calories</div>
            <div className="flex items-end gap-2 h-20">
              {[65, 80, 55, 90, 70, 85, 45].map((h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 1.5 + i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex-1 rounded-t bg-brand-500/80 dark:bg-brand-400/60"
                />
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span key={i} className="flex-1 text-center text-[8px] text-surface-400 dark:text-surface-500">{d}</span>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </div>
);

/* ─── Animated feature demo screen ─────────────────────────────── */
const FeatureDemo = ({ type }) => {
  if (type === 'ai') {
    return (
      <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 shadow-lg overflow-hidden">
        <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">AI Food Log</div>
        <div className="space-y-2.5">
          {[
            { text: '"I had 2 eggs, toast with butter, and orange juice"', delay: 0 },
          ].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 + m.delay, duration: 0.5 }}
              className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg px-3 py-2 text-sm text-surface-700 dark:text-surface-300">
              {m.text}
            </motion.div>
          ))}
          <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.7, duration: 0.5 }}
            className="rounded-lg border border-surface-200 dark:border-surface-700 p-3">
            <div className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 mb-2">✓ AI Parsed — 3 items detected</div>
            <div className="space-y-1.5">
              {[
                { name: 'Eggs (2 large)', cal: 156, pro: '13g' },
                { name: 'Toast w/ butter', cal: 167, pro: '4g' },
                { name: 'Orange juice (1 cup)', cal: 112, pro: '2g' },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 1 + i * 0.15, duration: 0.4 }}
                  className="flex justify-between items-center text-xs">
                  <span className="text-surface-700 dark:text-surface-300 font-medium">{item.name}</span>
                  <span className="text-surface-500 dark:text-surface-400">{item.cal} kcal · {item.pro}</span>
                </motion.div>
              ))}
            </div>
            <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.5, duration: 0.4 }}
              className="mt-2 pt-2 border-t border-surface-200 dark:border-surface-700 flex justify-between text-xs font-semibold">
              <span className="text-surface-900 dark:text-surface-100">Total</span>
              <span className="text-brand-600 dark:text-brand-400">435 kcal · 19g protein</span>
            </motion.div>
          </motion.div>
        </div>
      </div>
    );
  }

  // Coach demo
  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 shadow-lg overflow-hidden">
      <div className="text-xs font-semibold text-surface-500 dark:text-surface-400 uppercase tracking-wider mb-3">AI Coach</div>
      <div className="space-y-2">
        <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.5 }}
          className="bg-surface-50 dark:bg-surface-800 rounded-lg px-3 py-2 text-[11px] text-surface-500 dark:text-surface-400">
          🍔 You logged: <span className="font-semibold text-surface-700 dark:text-surface-200">Big Mac Combo</span> — 1,080 kcal
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.8, duration: 0.5 }}
          className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/40 rounded-lg px-3 py-2.5 text-sm text-surface-700 dark:text-surface-300 leading-relaxed">
          🔥 <span className="font-semibold">Strict Coach:</span> That's 54% of your daily budget in one meal. You've got 920 kcal left — make them count. Skip the fries next time and add a side salad. You got this. 💪
        </motion.div>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ delay: 1.3, duration: 0.5 }}
          className="flex gap-2">
          {['🔥 Strict', '😊 Friendly', '😏 Sarcastic', '💪 Motivational'].map((t,i) => (
            <span key={t} className={`text-[9px] px-2 py-1 rounded-md border ${i === 0 ? 'bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 border-transparent' : 'border-surface-200 dark:border-surface-700 text-surface-400 dark:text-surface-500'}`}>{t}</span>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/* ─── HOME PAGE ────────────────────────────────────────────────── */
const Home = () => {
  const { scrollYProgress } = useScroll();
  const mockupY = useTransform(scrollYProgress, [0, 0.3], [0, -40]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-surface-50 dark:bg-surface-950 grain">
      {/* Ambient gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-brand-400/[0.07] dark:bg-brand-400/[0.04] blur-[100px] animate-float-slow pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent-400/[0.06] dark:bg-accent-400/[0.03] blur-[100px] animate-float pointer-events-none" />
      <div className="absolute inset-0 bg-dots dark:bg-dots-dark bg-dots pointer-events-none opacity-40 dark:opacity-20" />

      {/* ── Nav ── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center text-white text-[9px] font-bold tracking-tight">FC</div>
          <span className="text-lg font-bold tracking-tight text-surface-900 dark:text-surface-100">FoodCal</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-surface-600 dark:text-surface-400 hover:text-surface-900 dark:hover:text-white transition-colors">
            Sign in
          </Link>
          <Link to="/register" className="text-sm font-semibold px-4 py-2 rounded-lg bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 hover:bg-surface-800 dark:hover:bg-white transition-colors">
            Get started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex flex-col items-center text-center px-6 pt-16 md:pt-24 pb-6 max-w-3xl mx-auto"
      >
        <motion.div variants={fadeUp} className="mb-6">
          <span className="pill border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
            AI calorie tracker and workout coach
          </span>
        </motion.div>

        <motion.h1 variants={fadeUp} className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-display text-surface-900 dark:text-surface-50 leading-[1.08]">
          Your personal<br />
          <span className="text-gradient">AI calorie tracker</span><br />
          and workout coach.
        </motion.h1>

        <motion.p variants={fadeUp} className="mt-6 text-lg md:text-xl text-surface-500 dark:text-surface-400 max-w-xl leading-relaxed">
          FoodCal is an AI-powered calorie tracker, nutrition log, and workout coach for health-focused individuals who want to log meals, track protein, and stay consistent.
        </motion.p>

        <motion.div variants={fadeUp} className="mt-10 flex flex-wrap gap-4 justify-center">
          <Link to="/register" className="group px-8 py-3.5 rounded-xl bg-surface-900 dark:bg-surface-100 text-white dark:text-surface-900 font-semibold text-base hover:bg-surface-800 dark:hover:bg-white transition-all shadow-lg shadow-surface-900/10 dark:shadow-black/20 active:scale-[0.97]">
            Start for free
            <span className="inline-block ml-1.5 transition-transform group-hover:translate-x-0.5">→</span>
          </Link>
          <Link to="/login" className="px-8 py-3.5 rounded-xl bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-300 font-semibold text-base border border-surface-200 dark:border-surface-700 hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-50 dark:hover:bg-surface-700 transition-all">
            Sign in
          </Link>
        </motion.div>
      </motion.section>

      {/* ── Animated Dashboard Preview ── */}
      <motion.section
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ y: mockupY }}
        className="relative z-10 px-6 pt-8 pb-20 md:pb-28"
      >
        <DashboardMockup />
        <div className="mt-4 text-center">
          <p className="text-xs text-surface-400 dark:text-surface-500">Live dashboard preview — your data, your way</p>
        </div>
      </motion.section>

      {/* ── Features grid ── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
        className="relative z-10 max-w-5xl mx-auto px-6 pb-24"
      >
        <motion.div variants={fadeUp} className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-surface-900 dark:text-surface-50">
            Everything you need to<br /><span className="text-gradient">log food and train smarter</span>
          </h2>
          <p className="mt-3 text-surface-500 dark:text-surface-400 max-w-lg mx-auto">
            Built for individuals serious about their health. FoodCal keeps your calorie tracking, workout tracking, and nutrition planning in one place.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((f, i) => (
            <motion.div key={i} variants={scaleUp} className="card p-6 md:p-8 group cursor-default">
              <div className="w-11 h-11 rounded-xl bg-surface-100 dark:bg-surface-800 flex items-center justify-center text-xl mb-4 group-hover:scale-110 transition-transform duration-500 ease-spring">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-surface-900 dark:text-surface-100 mb-1.5">{f.title}</h3>
              <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Interactive Demo Sections ── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24 space-y-20">
        {/* AI Food Logging demo */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-2 gap-10 items-center"
        >
          <motion.div variants={slideIn('left')}>
            <span className="pill border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30 text-xs mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> AI-Powered
            </span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight mt-3 mb-3">
              Log meals in natural language.
            </h3>
            <p className="text-surface-500 dark:text-surface-400 leading-relaxed mb-4">
              Type what you ate in natural language. FoodCal's AI parses ingredients, estimates portions, and calculates calories, protein, and macros without barcode scanning.
            </p>
            <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-300">
              {['Multi-item parsing in one sentence', 'Indian, Asian, Western cuisines supported', 'Learns from your log history'].map((t,i) => (
                <motion.li key={i} variants={fadeUp} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                  </span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </motion.div>
          <motion.div variants={slideIn('right')}>
            <FeatureDemo type="ai" />
          </motion.div>
        </motion.div>

        {/* AI Coach demo */}
        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-2 gap-10 items-center"
        >
          <motion.div variants={slideIn('left')} className="order-2 md:order-1">
            <FeatureDemo type="coach" />
          </motion.div>
          <motion.div variants={slideIn('right')} className="order-1 md:order-2">
            <span className="pill border border-accent-200 dark:border-accent-800 text-accent-700 dark:text-accent-400 bg-accent-50 dark:bg-accent-900/30 text-xs mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-500" /> Personalized
            </span>
            <h3 className="text-2xl md:text-3xl font-extrabold text-surface-900 dark:text-surface-50 tracking-tight mt-3 mb-3">
              A workout coach that gets you.
            </h3>
            <p className="text-surface-500 dark:text-surface-400 leading-relaxed mb-4">
              Choose your coach's personality — strict drill sergeant, sarcastic friend, or gentle motivator. It reacts to every log with context-aware advice tuned to your calorie target, workouts, and stats.
            </p>
            <ul className="space-y-2 text-sm text-surface-600 dark:text-surface-300">
              {['4 unique coaching personalities', 'Reacts to meals & workouts in real-time', 'Daily summary insights'].map((t,i) => (
                <motion.li key={i} variants={fadeUp} className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-500" />
                  </span>
                  {t}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </motion.div>
      </section>

      {/* ── How it works ── */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-60px" }}
        className="relative z-10 max-w-4xl mx-auto px-6 pb-28"
      >
        <motion.div variants={fadeUp} className="text-center mb-14">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-surface-900 dark:text-surface-50">
            Up and running in<br /><span className="text-gradient">4 simple steps</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-6">
          {HOW_IT_WORKS.map((step, i) => (
            <motion.div key={i} variants={scaleUp} className="card p-6 relative overflow-hidden group">
              <span className="absolute top-4 right-5 text-5xl font-extrabold text-surface-100 dark:text-surface-800 group-hover:text-brand-100 dark:group-hover:text-brand-900/30 transition-colors duration-500 select-none">{step.num}</span>
              <h4 className="text-base font-bold text-surface-900 dark:text-surface-100 mb-1.5 relative">{step.title}</h4>
              <p className="text-sm text-surface-500 dark:text-surface-400 leading-relaxed relative">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── Final CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 max-w-3xl mx-auto px-6 pb-24 text-center"
      >
        <div className="card p-10 md:p-14 bg-surface-900 dark:bg-surface-100 border-surface-800 dark:border-surface-200">
          <h2 className="text-2xl md:text-3xl font-extrabold text-white dark:text-surface-900 tracking-tight mb-3">
            Ready to take control of your health?
          </h2>
          <p className="text-surface-300 dark:text-surface-600 mb-8 max-w-md mx-auto">
            Join health-focused individuals who trust FoodCal's AI calorie tracker and workout coach to keep nutrition and training on point every day.
          </p>
          <Link to="/register" className="inline-block px-8 py-3.5 rounded-xl bg-white dark:bg-surface-900 text-surface-900 dark:text-surface-100 font-semibold text-base hover:bg-surface-50 dark:hover:bg-surface-800 transition-all active:scale-[0.97]">
            Get started for free <span className="ml-1">→</span>
          </Link>
        </div>
      </motion.section>

      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-24">
        <div className="card p-8 md:p-10">
          <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 items-start">
            <div>
              <span className="pill border border-surface-200 dark:border-surface-700 text-surface-600 dark:text-surface-300 bg-surface-50 dark:bg-surface-800 text-xs mb-4">
                SEO summary
              </span>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight text-surface-900 dark:text-surface-50">
                Track calories, log workouts, and coach your habits.
              </h2>
              <p className="mt-4 text-surface-500 dark:text-surface-400 leading-relaxed">
                FoodCal combines meal logging, calorie tracking, protein tracking, workout tracking, and AI coaching in one simple web app. Use it to understand what you eat, monitor daily energy balance, and make progress toward fitness goals.
              </p>
              <p className="mt-3 text-surface-500 dark:text-surface-400 leading-relaxed">
                The dashboard is built for fast input, clear nutrition data, and a clean experience on mobile and desktop so search engines and people can quickly understand the product value.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SEO_KEYWORDS.map((keyword) => (
                <div key={keyword} className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white/70 dark:bg-surface-900/60 px-4 py-3 text-sm font-medium text-surface-700 dark:text-surface-300">
                  {keyword}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-10 grid md:grid-cols-2 gap-4">
            {[
              {
                q: 'What is FoodCal?',
                a: 'FoodCal is an AI calorie tracker and workout coach for people who want a single place to log meals, monitor protein, and follow training progress.'
              },
              {
                q: 'How does the AI food log work?',
                a: 'You type or describe a meal in natural language, and FoodCal estimates ingredients, portions, calories, and protein so logging stays fast.'
              },
              {
                q: 'Does it help with workout tracking?',
                a: 'Yes. FoodCal tracks exercises, sets, reps, calories burned, and your daily balance alongside nutrition.'
              },
              {
                q: 'Who is it for?',
                a: 'It is built for health-focused users who want practical calorie tracking, meal logging, and coaching without unnecessary friction.'
              },
            ].map((item) => (
              <div key={item.q} className="rounded-2xl border border-surface-200 dark:border-surface-700 p-5 bg-surface-50 dark:bg-surface-900/50">
                <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 mb-2">{item.q}</h3>
                <p className="text-sm leading-relaxed text-surface-500 dark:text-surface-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-surface-200 dark:border-surface-800 py-8 text-center">
        <p className="text-xs text-surface-400 dark:text-surface-600">
          Built with React, Firebase & AI — <span className="text-surface-500 dark:text-surface-500">© {new Date().getFullYear()} FoodCal</span>
        </p>
      </footer>
    </div>
  );
};

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageTransition><Home /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/verify-email" element={<PageTransition><VerifyEmail /></PageTransition>} />
        <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
        <Route path="/profile-setup" element={<ProtectedRoute skipProfileCheck><PageTransition><ProfileSetup /></PageTransition></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><PageTransition><Profile /></PageTransition></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><PageTransition><Dashboard /></PageTransition></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <ThemeProvider>
    <BrowserRouter>
      <SeoAndAnalytics />
      <AnimatedRoutes />
    </BrowserRouter>
  </ThemeProvider>
);

const SeoAndAnalytics = () => {
  useEffect(() => {
    const gaId = process.env.REACT_APP_GA_MEASUREMENT_ID;
    if (!gaId || document.getElementById('foodcal-ga')) return;

    const script = document.createElement('script');
    script.id = 'foodcal-ga';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);

    globalThis.dataLayer = globalThis.dataLayer || [];
    function gtag() {
      globalThis.dataLayer.push(arguments);
    }
    globalThis.gtag = globalThis.gtag || gtag;
    globalThis.gtag('js', new Date());
    globalThis.gtag('config', gaId, { anonymize_ip: true });
  }, []);

  return null;
};

export default App;
