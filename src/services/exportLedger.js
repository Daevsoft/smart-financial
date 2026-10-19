import { t, localeTag } from "../state/i18n.js";
import { categoryById } from "../state/transactions.js";
import { accountById } from "../state/accounts.js";
import { toCSV } from "./storage.js";

const HEADERS = ["date", "description", "categoryCap", "accountCap", "type", "amount", "note"];

// id-ID renders 1.5 as "1,5", so its columns are separated with ";" instead.
const separatorFor = tag => (new Intl.NumberFormat(tag).format(1.5).includes(",") ? ";" : ",");

const accountCell = tx =>
  tx.type === "transfer"
    ? `${accountById(tx.fromAccountId).name} → ${accountById(tx.toAccountId).name}`
    : accountById(tx.accountId).name;

// Amounts go out as bare numbers — "Rp 1.436.471" lands in Excel as text.
export function ledgerToCSV(list) {
  const tag = localeTag();
  const amount = new Intl.NumberFormat(tag, { useGrouping: false, maximumFractionDigits: 20 });
  const rows = [
    HEADERS.map(key => t(key)),
    ...[...list]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(tx => [
        tx.date,
        tx.description,
        tx.type === "transfer" ? "—" : categoryById(tx.categoryId).name,
        accountCell(tx),
        t(tx.type === "income" ? "income" : tx.type === "transfer" ? "transfer" : "expense"),
        amount.format(tx.amount),
        tx.note || "",
      ]),
  ];
  return toCSV(rows, separatorFor(tag));
}
