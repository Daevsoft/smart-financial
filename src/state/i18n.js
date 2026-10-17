import { computed, effect } from "@daevsoft/jetz";
import { prefs } from "./store.js";

export const LANGUAGES = { en: "English", id: "Bahasa Indonesia" };

const DICT = {
  en: {
    // Nav / shell
    dashboard: "Dashboard",
    transactions: "Transactions",
    budgets: "Budgets",
    settings: "Settings",
    offlineTitle: "100% offline",
    offlineBody: "Your data never leaves this browser — everything lives in LocalStorage.",

    // Common
    cancel: "Cancel",
    close: "Close",
    menu: "Menu",
    gotIt: "Got it",
    allTime: "All time",
    income: "Income",
    expenses: "Expenses",
    expense: "Expense",
    date: "Date",
    edit: "Edit",
    delete: "Delete",
    description: "Description",
    category: "category",
    categoryCap: "Category",
    saveBudget: "Save Budget",
    categories: "categories",
    type: "Type",
    amount: "Amount",
    note: "Note",
    day: "day",
    days: "days",
    uncategorized: "Uncategorized",

    // Dashboard
    welcome: "Welcome back!",
    moneyFor: "Here's your money for {scope}.",
    totalBalance: "Total Balance",
    incomeMinusExpenses: "Income − expenses",
    savingsRate: "Savings Rate",
    noChange: "No change vs last month",
    vsLastMonth: "vs last month",
    onTrack: "on track",
    watchThis: "watch this",
    incomeKept: "Income kept this period",
    addIncomeTrack: "Add income to track savings",
    recentTransactions: "Recent Transactions",
    viewAll: "View all →",
    spendingOverview: "Spending Overview",
    totalSpent: "Total Spent",
    noSpending: "No spending recorded for this period yet.",

    // Budget alert
    overBudgetTitle: "Over budget this period",
    catsOverLimit: "{n} {unit} over limit · {amt} combined overspend",
    pctOf: "{pct}% of {amt}",
    spent: "spent",
    reviewBudgets: "Review budgets →",
    dismiss: "Dismiss",

    // Quick actions
    viewInsight: "View Insight",
    whereMoneyGoes: "Where your money goes",
    addTransaction: "Add Transaction",
    logIncomeExpense: "Log income or expense",
    addBudget: "Add Budget",
    setMonthlyLimit: "Set a monthly limit",

    // Insight modal
    spendingInsight: "Spending Insight",
    transactionsCount: "{n} transactions",
    topCategory: "Top category",
    biggestExpense: "Biggest expense",
    avgPerDay: "Avg spend / active day",
    acrossDays: "across {n} active {unit}",
    savingsKeptSub: "of income kept this period",
    budgetUsed: "Budget used",

    // Trend chart
    cashFlowTrend: "Cash Flow Trend",
    incomeVsExpenses: "income vs expenses",
    netTrend: "Monthly Net Trend",
    netTrendSub: "income − expenses, last 12 months",
    net: "Net",
    profit: "Profit",
    loss: "Loss",
    today: "Today",
    last30: "Last 30 days",
    last3m: "Last 3 months",
    last6m: "Last 6 months",
    last12m: "Last 12 months",
    noTrendData: "No data for this period yet.",

    // Transactions page
    inView: "in view",
    search: "Search",
    searchPlaceholder: "Search description or note…",
    allTypes: "All types",
    allCategories: "All categories",
    period: "Period",
    noTransactions: "No transactions found. Add one or adjust your filters.",

    // Transaction form
    newTransaction: "New Transaction",
    editTransaction: "Edit Transaction",
    descPlaceholder: "e.g. Starbucks",
    notePlaceholder: "Optional note",
    descRequired: "Description is required.",
    amountPositive: "Amount must be a positive number.",
    pickDate: "Pick a date.",
    saveChanges: "Save Changes",

    // Budgets page
    budgetsSub: "Monthly limits per category · viewing {scope}",
    overallUsage: "Overall budget usage",
    pctUsed: "{pct}% used",
    overBudgetShort: "over budget",
    noBudgetSet: "No budget set",
    left: "{amt} left",
    monthlyBudget: "Monthly budget",
    spentOf: "{spent} of {budget}",

    // Budget modal
    setMonthlyBudget: "Set Monthly Budget",
    monthlyLimit: "Monthly limit",
    enterValidAmount: "Enter a valid amount.",

    // Categories page
    categoriesPage: "Categories",
    categoriesSub: "{n} in total · used by transactions, budgets and charts",
    addCategory: "Add Category",
    newCategory: "New Category",
    editCategory: "Edit Category",
    categoryName: "Name",
    categoryNamePlaceholder: "e.g. Groceries",
    color: "Color",
    icon: "Icon",
    nameRequired: "Category name is required.",
    nameTaken: "A category with this name already exists.",
    usedBy: "{n} transactions use it",
    deleteCatConfirm: "Delete \"{name}\"? Transactions using it move to \"{fallback}\".",
    deleteCatLast: "Delete \"{name}\"? Transactions using it will show as Uncategorized.",
    noCategories: "No categories yet. Add your first one.",
    manageCategories: "Manage categories →",
    deleteCategory: "Delete category",

    // Settings
    settingsSub: "Preferences and data, stored locally in this browser.",
    appearance: "Appearance",
    themeDesc: "Theme applies instantly and is remembered across visits.",
    light: "Light",
    dark: "Dark",
    currency: "Currency",
    language: "Language",
    dataTitle: "Data",
    snapshotV1: "snapshot format v1",
    exportJson: "Export JSON",
    importJson: "Import JSON",
    loadDemo: "Load demo data",
    clearAll: "Clear all transactions",
    demoConfirm: "Replace current data with the generated demo dataset?",
    clearConfirm: "Delete ALL transactions? This cannot be undone.",
    statusExported: "Snapshot exported.",
    statusDemo: "Demo data loaded.",
    statusCleared: "All transactions deleted. Categories kept.",
    statusImported: "Imported {n} transactions and {m} categories.",
    importFailed: "Import failed: {msg}",
    about: "About",
    aboutBody:
      "FinTrack is built with Jetz — a composable JavaScript framework with no JSX and no virtual DOM. Everything runs offline; LocalStorage is the only database.",
  },

  id: {
    dashboard: "Dasbor",
    transactions: "Transaksi",
    budgets: "Anggaran",
    settings: "Pengaturan",
    offlineTitle: "100% luring",
    offlineBody: "Data Anda tidak pernah meninggalkan browser ini — semuanya tersimpan di LocalStorage.",

    cancel: "Batal",
    close: "Tutup",
    menu: "Menu",
    gotIt: "Mengerti",
    allTime: "Semua waktu",
    income: "Pemasukan",
    expenses: "Pengeluaran",
    expense: "Pengeluaran",
    date: "Tanggal",
    edit: "Ubah",
    delete: "Hapus",
    description: "Keterangan",
    category: "kategori",
    categoryCap: "Kategori",
    saveBudget: "Simpan Anggaran",
    categories: "kategori",
    type: "Jenis",
    amount: "Jumlah",
    note: "Catatan",
    day: "hari",
    days: "hari",
    uncategorized: "Tanpa Kategori",

    welcome: "Selamat datang kembali!",
    moneyFor: "Berikut ringkasan uang Anda untuk {scope}.",
    totalBalance: "Total Saldo",
    incomeMinusExpenses: "Pemasukan − pengeluaran",
    savingsRate: "Rasio Tabungan",
    noChange: "Tidak ada perubahan dari bulan lalu",
    vsLastMonth: "vs bulan lalu",
    onTrack: "sesuai target",
    watchThis: "perlu diperhatikan",
    incomeKept: "Pendapatan yang tersimpan periode ini",
    addIncomeTrack: "Tambahkan pemasukan untuk melacak tabungan",
    recentTransactions: "Transaksi Terakhir",
    viewAll: "Lihat semua →",
    spendingOverview: "Ikhtisar Pengeluaran",
    totalSpent: "Total Belanja",
    noSpending: "Belum ada pengeluaran pada periode ini.",

    overBudgetTitle: "Melebihi anggaran periode ini",
    catsOverLimit: "{n} {unit} melebihi batas · {amt} total kelebihan",
    pctOf: "{pct}% dari {amt}",
    spent: "terpakai",
    reviewBudgets: "Tinjau anggaran →",
    dismiss: "Tutup",

    viewInsight: "Lihat Wawasan",
    whereMoneyGoes: "Ke mana uang Anda pergi",
    addTransaction: "Tambah Transaksi",
    logIncomeExpense: "Catat pemasukan atau pengeluaran",
    addBudget: "Tambah Anggaran",
    setMonthlyLimit: "Tetapkan batas bulanan",

    spendingInsight: "Wawasan Pengeluaran",
    transactionsCount: "{n} transaksi",
    topCategory: "Kategori teratas",
    biggestExpense: "Pengeluaran terbesar",
    avgPerDay: "Rata-rata / hari aktif",
    acrossDays: "dalam {n} {unit} aktif",
    savingsKeptSub: "pendapatan yang tersimpan periode ini",
    budgetUsed: "Anggaran terpakai",

    cashFlowTrend: "Tren Arus Kas",
    incomeVsExpenses: "pemasukan vs pengeluaran",
    netTrend: "Tren Bersih Bulanan",
    netTrendSub: "pemasukan − pengeluaran, 12 bulan terakhir",
    net: "Bersih",
    profit: "Untung",
    loss: "Rugi",
    today: "Hari ini",
    last30: "30 hari terakhir",
    last3m: "3 bulan terakhir",
    last6m: "6 bulan terakhir",
    last12m: "12 bulan terakhir",
    noTrendData: "Belum ada data untuk periode ini.",

    inView: "transaksi ditampilkan",
    search: "Cari",
    searchPlaceholder: "Cari keterangan atau catatan…",
    allTypes: "Semua jenis",
    allCategories: "Semua kategori",
    period: "Periode",
    noTransactions: "Tidak ada transaksi. Tambahkan baru atau ubah filter Anda.",

    newTransaction: "Transaksi Baru",
    editTransaction: "Edit Transaksi",
    descPlaceholder: "cth. Starbucks",
    notePlaceholder: "Catatan opsional",
    descRequired: "Keterangan wajib diisi.",
    amountPositive: "Jumlah harus angka positif.",
    pickDate: "Pilih tanggal.",
    saveChanges: "Simpan Perubahan",

    budgetsSub: "Batas bulanan per kategori · melihat {scope}",
    overallUsage: "Total pemakaian anggaran",
    pctUsed: "{pct}% terpakai",
    overBudgetShort: "melebihi anggaran",
    noBudgetSet: "Belum ada anggaran",
    left: "{amt} tersisa",
    monthlyBudget: "Anggaran bulanan",
    spentOf: "{spent} dari {budget}",

    setMonthlyBudget: "Tetapkan Anggaran Bulanan",
    monthlyLimit: "Batas bulanan",
    enterValidAmount: "Masukkan jumlah yang valid.",

    categoriesPage: "Kategori",
    categoriesSub: "{n} total · dipakai transaksi, anggaran, dan grafik",
    addCategory: "Tambah Kategori",
    newCategory: "Kategori Baru",
    editCategory: "Ubah Kategori",
    categoryName: "Nama",
    categoryNamePlaceholder: "cth. Bahan Makanan",
    color: "Warna",
    icon: "Ikon",
    nameRequired: "Nama kategori wajib diisi.",
    nameTaken: "Kategori dengan nama ini sudah ada.",
    usedBy: "{n} transaksi memakainya",
    deleteCatConfirm: "Hapus \"{name}\"? Transaksi yang memakainya pindah ke \"{fallback}\".",
    deleteCatLast: "Hapus \"{name}\"? Transaksi yang memakainya akan menjadi Tanpa Kategori.",
    noCategories: "Belum ada kategori. Tambahkan yang pertama.",
    manageCategories: "Kelola kategori →",
    deleteCategory: "Hapus kategori",

    settingsSub: "Preferensi dan data, tersimpan lokal di browser ini.",
    appearance: "Tampilan",
    themeDesc: "Tema langsung diterapkan dan diingat antar kunjungan.",
    light: "Terang",
    dark: "Gelap",
    currency: "Mata Uang",
    language: "Bahasa",
    dataTitle: "Data",
    snapshotV1: "format snapshot v1",
    exportJson: "Ekspor JSON",
    importJson: "Impor JSON",
    loadDemo: "Muat data demo",
    clearAll: "Hapus semua transaksi",
    demoConfirm: "Ganti data saat ini dengan dataset demo?",
    clearConfirm: "Hapus SEMUA transaksi? Tindakan ini tidak bisa dibatalkan.",
    statusExported: "Snapshot berhasil diekspor.",
    statusDemo: "Data demo dimuat.",
    statusCleared: "Semua transaksi dihapus. Kategori tetap.",
    statusImported: "{n} transaksi dan {m} kategori berhasil diimpor.",
    importFailed: "Impor gagal: {msg}",
    about: "Tentang",
    aboutBody:
      "FinTrack dibangun dengan Jetz — framework JavaScript komposisional tanpa JSX dan tanpa virtual DOM. Semuanya berjalan luring; LocalStorage adalah satu-satunya basis data.",
  },
};

export function t(key, params) {
  const loc = prefs.language.value === "id" ? "id" : "en";
  let s = DICT[loc][key] !== undefined ? DICT[loc][key] : DICT.en[key];
  if (s === undefined) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

// Reactive text child: span(tt("key")) re-renders when the language changes.
export const tt = (key, params) => computed(() => t(key, params));

const MONTHS = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
};
const MONTHS_SHORT = {
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
};

export const monthName = i => MONTHS[prefs.language.value === "id" ? "id" : "en"][i];
export const monthShort = i => MONTHS_SHORT[prefs.language.value === "id" ? "id" : "en"][i];

export const localeTag = () => (prefs.language.value === "id" ? "id-ID" : "en-US");

// Keeps <html lang> in sync so screen readers and Intl defaults follow the UI.
effect(() => {
  document.documentElement.lang = prefs.language.value === "id" ? "id" : "en";
});
