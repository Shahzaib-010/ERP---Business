import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { requirePermission } from "@/server/permissions";
import { periodRange } from "@/server/services/cashbook";
import { daysBetween, parseDateOnly, todayPk } from "@/lib/business-date";

// Statistics for the showroom (dashboard → Showroom). Integer PKR.

const MONTH_FMT = new Intl.DateTimeFormat("en-PK", { month: "short", year: "2-digit", timeZone: "UTC" });
const AGE_BUCKETS = [
  { key: "a0_30", label: "Up to 30 days", test: (d) => d <= 30 },
  { key: "a31_60", label: "31–60 days", test: (d) => d >= 31 && d <= 60 },
  { key: "a61_90", label: "61–90 days", test: (d) => d >= 61 && d <= 90 },
  { key: "a90p", label: "Over 90 days", test: (d) => d > 90 },
];

const label = (b) => [b.make, b.model, b.modelYear, b.color].filter(Boolean).join(" ");

export async function getShowroomInsights(actor, period = "month") {
  requirePermission(actor, "bikes.view");
  await connectDB();
  const today = todayPk();
  const t = parseDateOnly(today);
  const range = periodRange(period, today);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTH_FMT.format(d) };
  });

  const bikes = await Bike.find().lean();
  const inRange = (d, from, to) => d && d >= from && d < to;
  const stock = bikes.filter((b) => b.status === "in_stock");
  const sold = bikes.filter((b) => b.status === "sold" && b.sale?.date);
  const soldNow = sold.filter((b) => inRange(b.sale.date, range.from, range.to));
  const soldPrev = sold.filter((b) => inRange(b.sale.date, range.prevFrom, range.prevTo));
  const boughtNow = bikes.filter((b) => inRange(b.purchase.date, range.from, range.to));
  const boughtPrev = bikes.filter((b) => inRange(b.purchase.date, range.prevFrom, range.prevTo));
  const sum = (list, f) => list.reduce((s, b) => s + f(b), 0);

  // Monthly bought / sold counts and sales value by mode.
  const trend = months.map((m) => {
    const s = sold.filter((b) => b.sale.date.toISOString().slice(0, 7) === m.key);
    return {
      month: m.key,
      label: m.label,
      bought: bikes.filter((b) => b.purchase.date.toISOString().slice(0, 7) === m.key).length,
      sold: s.length,
      salesCash: sum(s.filter((b) => b.sale.mode === "cash"), (b) => b.sale.price),
      salesInstallment: sum(s.filter((b) => b.sale.mode === "installment"), (b) => b.sale.price),
    };
  });

  // Stock breakdowns.
  const byMake = {};
  for (const b of stock) {
    const k = b.make.trim().toLowerCase();
    const row = byMake[k] ?? (byMake[k] = { key: k, label: b.make.trim(), value: 0, count: 0 });
    row.value += b.purchase.price;
    row.count += 1;
  }
  const age = AGE_BUCKETS.map((a) => ({ key: a.key, label: a.label, count: 0, value: 0 }));
  for (const b of stock) {
    const d = daysBetween(b.purchase.date, t);
    const a = age[AGE_BUCKETS.findIndex((x) => x.test(d))];
    a.count += 1;
    a.value += b.purchase.price;
  }
  const condition = ["new", "used"].map((c) => ({
    key: c,
    label: c === "new" ? "New" : "Used",
    count: stock.filter((b) => b.condition === c).length,
    value: sum(stock.filter((b) => b.condition === c), (b) => b.purchase.price),
  }));

  // Days from purchase to sale, for bikes sold in the last 12 months.
  const yearAgo = new Date(Date.UTC(t.getUTCFullYear() - 1, t.getUTCMonth(), t.getUTCDate()));
  const recentSold = sold.filter((b) => b.sale.date >= yearAgo);
  const avgDaysToSell = recentSold.length ? Math.round(sum(recentSold, (b) => Math.max(0, daysBetween(b.purchase.date, b.sale.date))) / recentSold.length) : null;

  const customerIds = [...new Set(sold.map((b) => String(b.sale.customerId)))];
  const customers = customerIds.length ? await Customer.find({ _id: { $in: customerIds } }).select("name").lean() : [];
  const cById = new Map(customers.map((c) => [String(c._id), c.name]));

  const brief = (b) => ({
    id: String(b._id),
    bikeNumber: b.bikeNumber,
    label: label(b),
    condition: b.condition,
    purchasePrice: b.purchase.price,
    purchaseDate: b.purchase.date,
    payable: b.purchaseTotals?.payable ?? 0,
    seller: b.purchase.seller.name,
    daysInStock: daysBetween(b.purchase.date, t),
  });

  return {
    period,
    range: { label: range.label },
    kpis: {
      sold: { value: soldNow.length, previous: soldPrev.length },
      salesValue: { value: sum(soldNow, (b) => b.sale.price), previous: sum(soldPrev, (b) => b.sale.price), cash: sum(soldNow.filter((b) => b.sale.mode === "cash"), (b) => b.sale.price) },
      bought: { value: boughtNow.length, previous: boughtPrev.length, spend: sum(boughtNow, (b) => b.purchase.price) },
      avgDaysToSell,
    },
    position: {
      inStock: stock.length,
      stockValue: sum(stock, (b) => b.purchase.price),
      owedToSellers: sum(bikes, (b) => b.purchaseTotals?.payable ?? 0),
      owedBikes: bikes.filter((b) => (b.purchaseTotals?.payable ?? 0) > 0).length,
      newInStock: condition[0].count,
      usedInStock: condition[1].count,
    },
    trend,
    byMake: Object.values(byMake).sort((a, b) => b.value - a.value),
    age,
    condition,
    oldestStock: [...stock].sort((a, b) => a.purchase.date - b.purchase.date).slice(0, 6).map(brief),
    owed: bikes.filter((b) => (b.purchaseTotals?.payable ?? 0) > 0).sort((a, b) => b.purchaseTotals.payable - a.purchaseTotals.payable).slice(0, 6).map(brief),
    recentSales: [...sold]
      .sort((a, b) => b.sale.date - a.sale.date)
      .slice(0, 6)
      .map((b) => ({ ...brief(b), sale: { mode: b.sale.mode, date: b.sale.date, price: b.sale.price, customer: cById.get(String(b.sale.customerId)) ?? "Customer", planId: b.sale.planId ? String(b.sale.planId) : null } })),
  };
}
