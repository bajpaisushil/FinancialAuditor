/** A realistic, messy demo statement so users can try the tool with Wi-Fi off. */
export function sampleCsv(): string {
  const rows: string[] = ["Date,Description,Amount"];

  // merchant, raw-ish descriptor, base amount, day-of-month, cadenceDays, hike?
  const subs: [string, number, number, number, number | null][] = [
    ["NETFLIX.COM 866-579-7172 CA", 15.49, 4, 30, 17.99], // price hike
    ["Spotify USA   NY", 10.99, 9, 30, null],
    ["AMZN Prime*2K4LP9 Amzn.com/bill WA", 14.99, 14, 30, null],
    ["ADOBE  *CREATIVE CLD 408-536-6000", 54.99, 18, 30, null],
    ["NYTimes*NYTimes 800-698-4637 NY", 4.25, 22, 30, 17.0], // big hike
    ["PLANET FIT  CLUB FEES 8775766", 24.99, 1, 30, null],
    ["ICLOUD+ APPLE.COM/BILL", 2.99, 16, 30, null],
    ["DISNEY PLUS 888-905-7888", 7.99, 7, 30, 13.99],
    ["CHATGPT SUBSCRIPTION OPENAI", 20.0, 11, 30, null],
    ["AUDIBLE*RX12 Amzn.com/bill", 14.95, 25, 30, null],
    ["GITHUB.COM HTTPSGITHUB CA", 4.0, 2, 30, null],
    ["BLUE BOTTLE COFFEE SF CA", 18.5, 6, 7, null], // weekly-ish, inconsistent -> low confidence
    ["DOORDASH*MCDONALDS 855-973", 27.4, 13, 14, null], // noise, varying amount
  ];

  // One-off purchases (noise that should NOT be flagged as recurring).
  const oneOffs: [string, number, string][] = [
    ["TARGET 00012345 MINNEAPOLIS MN", 84.21, "2025-03-12"],
    ["SHELL OIL 5747 HOUSTON TX", 52.0, "2025-04-02"],
    ["DELTA AIR 0062317654321", 412.6, "2025-02-19"],
    ["WHOLEFDS MKT 10259", 63.18, "2025-05-08"],
    ["PAYROLL DEPOSIT ACME CORP", -3200.0, "2025-03-29"], // income, ignored
  ];

  const months = [2, 3, 4, 5, 6]; // Feb–Jun 2025
  for (const [desc, base, dom, cadence, hikeTo] of subs) {
    if (cadence >= 28) {
      months.forEach((m, idx) => {
        const amt = hikeTo && idx >= 3 ? hikeTo : base;
        rows.push(`2025-${pad(m)}-${pad(dom)},"${desc}",-${amt.toFixed(2)}`);
      });
    } else {
      // weekly/biweekly: sprinkle across the window with a little jitter
      let day = 3;
      for (let i = 0; i < 8; i++) {
        const m = 3 + Math.floor((day - 1) / 30);
        const dd = ((day - 1) % 30) + 1;
        const jitter = cadence < 10 ? (i % 3) - 1 : 0;
        const amt = base + jitter * 2.3;
        if (m <= 6) rows.push(`2025-${pad(m)}-${pad(dd)},"${desc}",-${amt.toFixed(2)}`);
        day += cadence;
      }
    }
  }

  for (const [desc, amt, date] of oneOffs) {
    const sign = amt < 0 ? "" : "-";
    rows.push(`${date},"${desc}",${sign}${Math.abs(amt).toFixed(2)}`);
  }

  return rows.join("\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
