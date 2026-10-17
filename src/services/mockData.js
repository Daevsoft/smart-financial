import categoriesSeed from "../data/categories.json";

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MERCHANTS = {
  food: ["Starbucks", "Blue Bottle Coffee", "Sweetgreen", "Uber Eats", "Green Grocer", "Pizza Nova", "Bakline Bakery"],
  shopping: ["Amazon.com", "Uniqlo", "IKEA", "Muji", "City Mall"],
  transport: ["Uber", "Shell Station", "Metro Card", "Parking Garage", "Lime Scooter"],
  entertainment: ["Cinema City", "Steam", "Concert Hall", "Board Game Cafe"],
  bills: ["Electricity Bill", "Internet", "Mobile Plan", "Water Utility"],
  health: ["Pharmacy", "Gym Membership", "Dental Clinic", "Vitamins Plus"],
  other: ["Post Office", "Donation", "Gift Shop", "Bookstore"],
};

const RANGES = {
  food: [4, 55],
  shopping: [15, 240],
  transport: [3, 45],
  entertainment: [8, 60],
  bills: [25, 140],
  health: [10, 120],
  other: [5, 80],
};

export function generateDemoData() {
  const rand = mulberry32(20260831);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  // The app defaults to IDR, so the ledger is generated in rupiah. The ranges
  // below keep their original dollar-scale tuning and are multiplied out, which
  // preserves every ratio the demo was calibrated on (budget vs spend, income
  // vs expense).
  const money = v => Math.round(v * 16000);
  const amount = (min, max) => money(min + rand() * (max - min));
  const txs = [];
  let n = 0;
  const id = () => `tx-gen-${++n}`;
  const now = new Date();
  const year = now.getFullYear();
  // January up to August of the current year (cap at the current month).
  const endMonth = Math.min(7, now.getMonth());

  for (let month = 0; month <= endMonth; month++) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lastDay =
      year === now.getFullYear() && month === now.getMonth() ? now.getDate() : daysInMonth;
    const day = d => `${year}-${String(month + 1).padStart(2, "0")}-${String(Math.min(d, lastDay)).padStart(2, "0")}`;
    // Gentle inflation so the trend lines drift upward over the year.
    const drift = 1 + month * 0.035;
    const cost = (min, max) => Math.round(amount(min, max) * drift);

    txs.push({
      id: id(),
      date: day(1),
      description: "Monthly Salary",
      categoryId: "salary",
      type: "income",
      amount: month >= 4 ? amount(3700, 4100) : amount(3400, 3900),
      note: "",
    });
    if (lastDay >= 18) {
      txs.push({ id: id(), date: day(18), description: "Freelance Project", categoryId: "salary", type: "income", amount: cost(300, 900), note: "" });
    }

    const recurring = [
      { d: 3, c: "bills", desc: "Electricity Bill", min: 60, max: 140 },
      { d: 5, c: "bills", desc: "Internet", min: 45, max: 60 },
      { d: 8, c: "bills", desc: "Mobile Plan", min: 25, max: 40 },
      { d: 12, c: "entertainment", desc: "Netflix", min: 15.49, max: 15.49 },
      { d: 14, c: "entertainment", desc: "Spotify", min: 9.99, max: 9.99 },
    ];
    for (const r of recurring) {
      if (lastDay >= r.d) {
        txs.push({ id: id(), date: day(r.d), description: r.desc, categoryId: r.c, type: "expense", amount: cost(r.min, r.max), note: "" });
      }
    }

    for (const cat of ["food", "shopping", "transport", "health", "other"]) {
      // Summer months nudge shopping up; December-like spikes stay out of range.
      const count = (cat === "shopping" && month >= 5 ? 6 : 4) + Math.floor(rand() * 4);
      for (let i = 0; i < count; i++) {
        txs.push({
          id: id(),
          date: day(1 + Math.floor(rand() * lastDay)),
          description: pick(MERCHANTS[cat]),
          categoryId: cat,
          type: "expense",
          amount: cost(...RANGES[cat]),
          note: "",
        });
      }
    }

    // One memorable outlier so the yearly chart has a story.
    if (month === 6) {
      txs.push({ id: id(), date: day(9), description: "Summer Vacation", categoryId: "entertainment", type: "expense", amount: amount(850, 1250), note: "Trip" });
      txs.push({ id: id(), date: day(11), description: "Flight Tickets", categoryId: "transport", type: "expense", amount: amount(420, 560), note: "Trip" });
    }
    if (month === 2) {
      txs.push({ id: id(), date: day(21), description: "New Laptop", categoryId: "shopping", type: "expense", amount: amount(900, 1200), note: "" });
    }
  }

  const transactions = txs.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  // Same scale-up for the seed budgets, otherwise every category reads as
  // catastrophically over budget.
  const categories = categoriesSeed.map(c => ({ ...c, budget: money(c.budget) }));
  return { categories, transactions };
}
