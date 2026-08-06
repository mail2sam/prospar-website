/* ============================================================
   Prospar Consulting: Shared Finance Engine (v0.1 prototype)
   Pure functions only. One convention everywhere:
     - returns compound MONTHLY (i = annual/12)
     - SIP instalments are annuity-due (invested at month start)
     - step-up applies ANNUALLY (once every 12 instalments)
   Runs in browser (window.ProFin) and Node (module.exports).
   Self-test: node finance-engine.js --test
   ============================================================ */
(function (root) {
  "use strict";

  var EPS = 1e-9;

  /* ---------- core time-value ---------- */

  function fvLumpsum(principal, annualRatePct, years) {
    return principal * Math.pow(1 + annualRatePct / 100, years);
  }

  function pvLumpsum(target, annualRatePct, years) {
    return target / Math.pow(1 + annualRatePct / 100, years);
  }

  /* FV of a flat monthly SIP (annuity-due, monthly compounding) */
  function sipFV(monthly, annualRatePct, years) {
    var n = Math.round(years * 12);
    var i = annualRatePct / 100 / 12;
    if (Math.abs(i) < EPS) return monthly * n;
    return monthly * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  }

  /* Monthly SIP needed to reach a target (inverse of sipFV) */
  function requiredSip(target, annualRatePct, years) {
    var unit = sipFV(1, annualRatePct, years);
    return unit > 0 ? target / unit : 0;
  }

  /* FV of a step-up SIP: instalment rises stepUpPct once a year.
     Month-by-month simulation keeps the convention transparent. */
  function stepUpSipFV(monthly, annualRatePct, years, stepUpPct) {
    var n = Math.round(years * 12);
    var i = annualRatePct / 100 / 12;
    var bal = 0, sip = monthly;
    for (var m = 0; m < n; m++) {
      if (m > 0 && m % 12 === 0) sip *= 1 + stepUpPct / 100;
      bal = (bal + sip) * (1 + i);
    }
    return bal;
  }

  /* Starting SIP needed to reach target with an annual step-up.
     FV is linear in the starting instalment, so scale a unit run. */
  function requiredStepUpSip(target, annualRatePct, years, stepUpPct) {
    var unit = stepUpSipFV(1, annualRatePct, years, stepUpPct);
    return unit > 0 ? target / unit : 0;
  }

  /* Year-wise schedule for (possibly stepped-up) SIP + optional
     starting lumpsum. Rows are year-end snapshots. */
  function sipSchedule(opts) {
    var monthly = opts.monthly || 0;
    var ratePct = opts.annualRatePct || 0;
    var years = opts.years || 0;
    var stepUpPct = opts.stepUpPct || 0;
    var lumpsum = opts.lumpsum || 0;

    var i = ratePct / 100 / 12;
    var rows = [];
    var bal = lumpsum, invested = lumpsum, sip = monthly;

    for (var y = 1; y <= years; y++) {
      if (y > 1) sip *= 1 + stepUpPct / 100;
      var investedThisYear = 0;
      for (var m = 0; m < 12; m++) {
        bal = (bal + sip) * (1 + i);
        investedThisYear += sip;
      }
      invested += investedThisYear;
      rows.push({
        year: y,
        monthlySip: sip,
        investedThisYear: investedThisYear,
        cumInvested: invested,
        value: bal,
        gains: bal - invested
      });
    }
    return rows;
  }

  /* ---------- inflation ---------- */

  function todaysValue(amount, inflationPct, years) {
    return amount / Math.pow(1 + inflationPct / 100, years);
  }

  function inflate(amount, inflationPct, years) {
    return amount * Math.pow(1 + inflationPct / 100, years);
  }

  /* ---------- other calculators (shared later phases) ---------- */

  function cagr(pv, fv, years) {
    if (pv <= 0 || years <= 0) return NaN;
    return (Math.pow(fv / pv, 1 / years) - 1) * 100;
  }

  function emi(principal, annualRatePct, months) {
    var r = annualRatePct / 100 / 12;
    if (Math.abs(r) < EPS) return principal / months;
    var f = Math.pow(1 + r, months);
    return (principal * r * f) / (f - 1);
  }

  function simpleInterestFV(principal, ratePct, years) {
    return principal * (1 + (ratePct / 100) * years);
  }

  /* Compound FV at m compounding periods per year (1/2/4/12/365) */
  function compoundFV(principal, ratePct, years, m) {
    m = m || 1;
    return principal * Math.pow(1 + ratePct / 100 / m, m * years);
  }

  function effectiveAnnualRate(ratePct, m) {
    m = m || 1;
    return (Math.pow(1 + ratePct / 100 / m, m) - 1) * 100;
  }

  /* Year-end snapshots of a lumpsum growing at ratePct (m compounding) */
  function lumpsumSchedule(principal, ratePct, years, m) {
    var rows = [];
    for (var y = 1; y <= years; y++) {
      var v = compoundFV(principal, ratePct, y, m || 1);
      rows.push({ year: y, value: v, gains: v - principal });
    }
    return rows;
  }

  /* ---------- loans ---------- */

  /* Full amortization. opts.extraMonthly adds a constant prepayment
     each month (EMI unchanged, tenure shrinks). Returns yearly rows. */
  function amortize(principal, annualRatePct, months, opts) {
    opts = opts || {};
    var extra = opts.extraMonthly || 0;
    var r = annualRatePct / 100 / 12;
    var pay = emi(principal, annualRatePct, months);
    var bal = principal, m = 0, totalInterest = 0;
    var yearly = [], yP = 0, yI = 0;
    var guard = months * 2 + 1200;

    while (bal > 0.005 && m < guard) {
      m++;
      var interest = bal * r;
      var principalPart = Math.min(bal, pay - interest + extra);
      if (pay - interest <= 0 && extra <= 0) break; // EMI doesn't cover interest
      totalInterest += interest;
      bal -= principalPart;
      yP += principalPart; yI += interest;
      if (m % 12 === 0 || bal <= 0.005) {
        yearly.push({
          year: Math.ceil(m / 12),
          principalPaid: yP,
          interestPaid: yI,
          balance: Math.max(0, bal)
        });
        yP = 0; yI = 0;
      }
    }
    return {
      emi: pay,
      months: m,
      totalInterest: totalInterest,
      totalPaid: principal + totalInterest,
      yearly: yearly
    };
  }

  /* ---------- retirement / decumulation ---------- */

  /* Corpus needed at retirement to fund an inflation-growing annual
     expense (withdrawn at year start) for `yearsInRet` years. */
  function requiredCorpus(firstYearAnnualExpense, postRetRatePct, inflationPct, yearsInRet) {
    var q = (1 + inflationPct / 100) / (1 + postRetRatePct / 100);
    if (Math.abs(1 - q) < EPS) return firstYearAnnualExpense * yearsInRet;
    return firstYearAnnualExpense * (1 - Math.pow(q, yearsInRet)) / (1 - q);
  }

  /* Year-by-year corpus depletion after retirement.
     Expense withdrawn at year start (net of any income); rest grows. */
  function depletionSchedule(opts) {
    var corpus = opts.corpus;
    var age = opts.retireAge;
    var endAge = opts.lifeExpectancy;
    var expense = opts.firstYearAnnualExpense;
    var infl = (opts.inflationPct || 0) / 100;
    var rate = (opts.postRetRatePct || 0) / 100;
    var income = opts.annualIncome || 0;
    var incomeGrowth = (opts.incomeGrowthPct || 0) / 100;
    var incomeTillAge = opts.incomeTillAge || 0;

    var rows = [], runsOutAge = null, bal = corpus;
    for (var a = age; a < endAge; a++) {
      var inc = (a < incomeTillAge) ? income : 0;
      var net = Math.max(0, expense - inc);
      var opening = bal;
      var withdrawal = Math.min(bal, net);
      bal = (bal - withdrawal) * (1 + rate);
      rows.push({
        age: a + 1,                 // value at END of this year of age a
        expense: expense,
        income: inc,
        withdrawal: withdrawal,
        opening: opening,
        closing: bal
      });
      if (runsOutAge === null && withdrawal < net - 0.5) runsOutAge = a;
      expense *= 1 + infl;
      income *= 1 + incomeGrowth;
    }
    return { rows: rows, runsOutAge: runsOutAge, finalBalance: bal };
  }

  /* Complete pre-retirement plan */
  function retirementPlan(opts) {
    var yearsToRet = opts.retireAge - opts.currentAge;
    var yearsInRet = opts.lifeExpectancy - opts.retireAge;
    var expenseAtRet = inflate(opts.annualExpenseToday, opts.inflationPct, yearsToRet);
    var corpusNeeded = requiredCorpus(expenseAtRet, opts.postRetRatePct, opts.inflationPct, yearsInRet);
    var fvExisting = fvLumpsum(opts.existingCorpus || 0, opts.existingRatePct !== undefined ? opts.existingRatePct : opts.preRetRatePct, yearsToRet);
    var gap = Math.max(0, corpusNeeded - fvExisting);
    return {
      yearsToRet: yearsToRet,
      yearsInRet: yearsInRet,
      expenseAtRet: expenseAtRet,
      corpusNeeded: corpusNeeded,
      fvExisting: fvExisting,
      gap: gap,
      requiredSipFlat: requiredSip(gap, opts.preRetRatePct, yearsToRet),
      requiredSipStepUp: opts.stepUpPct > 0
        ? requiredStepUpSip(gap, opts.preRetRatePct, yearsToRet, opts.stepUpPct)
        : null,
      requiredLumpsum: pvLumpsum(gap, opts.preRetRatePct, yearsToRet)
    };
  }

  /* ---------- SWP ---------- */

  /* Monthly SWP simulation: withdraw at month start, grow the rest.
     Stops withdrawing once the corpus is exhausted. */
  function swpSimulate(opts) {
    var bal = opts.corpus;
    var wd = opts.monthlyWithdrawal;
    var i = (opts.annualRatePct || 0) / 100 / 12;
    var stepUp = (opts.stepUpPct || 0) / 100;
    var months = Math.round((opts.years || 0) * 12);
    var rows = [], cum = 0, depletedAtMonth = null;
    var yWd = 0;

    for (var m = 1; m <= months; m++) {
      if (m > 1 && (m - 1) % 12 === 0) wd *= 1 + stepUp;
      var actual = Math.min(bal, wd);
      if (depletedAtMonth === null && actual < wd - 0.005) depletedAtMonth = m;
      bal = (bal - actual) * (1 + i);
      cum += actual; yWd += actual;
      if (m % 12 === 0) {
        rows.push({
          year: m / 12,
          monthlyWithdrawal: wd,
          withdrawnThisYear: yWd,
          cumWithdrawn: cum,
          closing: bal
        });
        yWd = 0;
      }
    }
    return { rows: rows, depletedAtMonth: depletedAtMonth, totalWithdrawn: cum, finalBalance: bal };
  }

  /* Largest starting monthly withdrawal that survives the horizon */
  function maxSustainableWithdrawal(opts) {
    var lo = 0, hi = opts.corpus; // monthly, upper bound generous
    for (var k = 0; k < 60; k++) {
      var mid = (lo + hi) / 2;
      var sim = swpSimulate({
        corpus: opts.corpus, monthlyWithdrawal: mid,
        annualRatePct: opts.annualRatePct, stepUpPct: opts.stepUpPct,
        years: opts.years
      });
      if (sim.depletedAtMonth === null) lo = mid; else hi = mid;
    }
    return lo;
  }

  /* ---------- NPS ---------- */

  function npsProject(opts) {
    var years = opts.retireAge - opts.currentAge;
    var sched = sipSchedule({
      monthly: opts.monthly, annualRatePct: opts.annualRatePct,
      years: years, stepUpPct: opts.stepUpPct || 0
    });
    var last = sched[sched.length - 1] || { value: 0, cumInvested: 0 };
    var annuityAmt = last.value * (opts.annuityPct / 100);
    return {
      years: years,
      schedule: sched,
      corpus: last.value,
      invested: last.cumInvested,
      gains: last.value - last.cumInvested,
      annuityAmt: annuityAmt,
      lumpSum: last.value - annuityAmt,
      monthlyPension: annuityAmt * (opts.annuityRatePct / 100) / 12
    };
  }

  /* ---------- FIRE ---------- */

  function fireTargets(monthlyExpenseToday, inflationPct, yearsToRetire) {
    var annualAtRet = inflate(monthlyExpenseToday * 12, inflationPct, yearsToRetire);
    return {
      annualAtRet: annualAtRet,
      lean: annualAtRet * 20,
      standard: annualAtRet * 25,
      comfortable: annualAtRet * 30
    };
  }

  /* First year the projected wealth crosses `multiple` × that year's
     inflated annual expense. null if not within maxYears. */
  function fireFreedomYear(opts) {
    var maxYears = opts.maxYears || 60;
    var i = (opts.ratePct || 0) / 100 / 12;
    var stepUp = (opts.stepUpPct || 0) / 100;
    var bal = opts.currentCorpus || 0;
    var sip = opts.monthlySip || 0;
    for (var y = 1; y <= maxYears; y++) {
      if (y > 1) sip *= 1 + stepUp;
      for (var m = 0; m < 12; m++) bal = (bal + sip) * (1 + i);
      var need = inflate(opts.monthlyExpenseToday * 12, opts.inflationPct, y) * opts.multiple;
      if (bal >= need) return y;
    }
    return null;
  }

  /* ---------- formatting (Indian conventions) ---------- */

  var inrFmt = typeof Intl !== "undefined"
    ? new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 })
    : { format: function (n) { return String(Math.round(n)); } };

  function formatINR(n) {
    if (!isFinite(n)) return "N/A";
    var sign = n < 0 ? "−" : "";
    return sign + "₹" + inrFmt.format(Math.abs(Math.round(n)));
  }

  /* ₹1.24 Cr / ₹45.2 L / ₹85,400 */
  function formatINRCompact(n) {
    if (!isFinite(n)) return "N/A";
    var sign = n < 0 ? "−" : "";
    var a = Math.abs(n);
    if (a >= 1e7) {
      var cr = a / 1e7;
      return sign + "₹" + (cr >= 100 ? Math.round(cr) : cr.toFixed(2)) + " Cr";
    }
    if (a >= 1e5) {
      var l = a / 1e5;
      return sign + "₹" + (l >= 100 ? Math.round(l) : l.toFixed(1)) + " L";
    }
    return sign + "₹" + inrFmt.format(Math.round(a));
  }

  function formatPct(n, dp) {
    if (!isFinite(n)) return "N/A";
    return n.toFixed(dp === undefined ? 1 : dp) + "%";
  }

  /* ---------- self-test ---------- */

  function approx(a, b, tolPct) {
    return Math.abs(a - b) <= Math.abs(b) * (tolPct || 0.001);
  }

  function selfTest() {
    var t = [];
    function check(name, cond) { t.push({ name: name, pass: !!cond }); }

    // Known values (cross-checked against standard published calculators)
    check("lumpsum 1L @12% 10y = 3,10,585",
      approx(fvLumpsum(100000, 12, 10), 310585, 0.001));
    check("SIP 10k @12% 10y (due) = 23,23,391",
      approx(sipFV(10000, 12, 10), 2323391, 0.001));
    check("requiredSip inverts sipFV",
      approx(requiredSip(sipFV(10000, 12, 10), 12, 10), 10000, 0.0001));
    check("stepUp 0% equals flat SIP",
      approx(stepUpSipFV(10000, 12, 10, 0), sipFV(10000, 12, 10), 1e-9));
    check("stepUp 10% beats flat SIP",
      stepUpSipFV(10000, 12, 10, 10) > sipFV(10000, 12, 10));
    check("requiredStepUpSip inverts stepUpSipFV",
      approx(requiredStepUpSip(stepUpSipFV(10000, 12, 15, 10), 12, 15, 10), 10000, 0.0001));
    check("schedule final value matches stepUpSipFV",
      approx(
        sipSchedule({ monthly: 10000, annualRatePct: 12, years: 15, stepUpPct: 10 })[14].value,
        stepUpSipFV(10000, 12, 15, 10), 1e-9));
    check("schedule cumInvested (flat) = 12*y*sip",
      approx(
        sipSchedule({ monthly: 5000, annualRatePct: 10, years: 8 })[7].cumInvested,
        5000 * 12 * 8, 1e-9));
    check("zero-rate SIP = sum of instalments",
      approx(sipFV(1000, 0, 3), 36000, 1e-9));
    check("todaysValue inverts inflate",
      approx(todaysValue(inflate(50000, 6, 12), 6, 12), 50000, 1e-9));
    check("CAGR 1L→2L in 6y = 12.246%",
      approx(cagr(100000, 200000, 6), 12.2462, 0.001));
    check("EMI 50L @8.5% 240m = 43,391",
      approx(emi(5000000, 8.5, 240), 43391, 0.001));
    check("formatINRCompact 12500000 = ₹1.25 Cr",
      formatINRCompact(12500000) === "₹1.25 Cr");
    check("formatINRCompact 350000 = ₹3.5 L",
      formatINRCompact(350000) === "₹3.5 L");

    // compounding
    check("compoundFV quarterly 1L @12% 5y = 1,80,611",
      approx(compoundFV(100000, 12, 5, 4), 180611, 0.001));
    check("EAR 12% quarterly = 12.55%",
      approx(effectiveAnnualRate(12, 4), 12.5509, 0.001));
    check("simple interest 1L @10% 5y = 1.5L",
      approx(simpleInterestFV(100000, 10, 5), 150000, 1e-9));

    // amortization
    var am = amortize(5000000, 8.5, 240);
    check("amortize EMI matches emi()", approx(am.emi, emi(5000000, 8.5, 240), 1e-9));
    check("amortize runs full 240 months", am.months === 240);
    check("amortize total interest ≈ 54.14L", approx(am.totalInterest, 5413879, 0.001));
    check("amortize principal sums to loan",
      approx(am.yearly.reduce(function (s, r) { return s + r.principalPaid; }, 0), 5000000, 1e-6));
    var amPre = amortize(5000000, 8.5, 240, { extraMonthly: 10000 });
    check("prepayment shortens tenure", amPre.months < 240);
    check("prepayment saves interest", amPre.totalInterest < am.totalInterest);

    // retirement
    check("requiredCorpus r=i equals E×years",
      approx(requiredCorpus(1200000, 6, 6, 25), 1200000 * 25, 1e-9));
    var rc = requiredCorpus(1200000, 8, 6, 25);
    var dep = depletionSchedule({
      corpus: rc, retireAge: 60, lifeExpectancy: 85,
      firstYearAnnualExpense: 1200000, inflationPct: 6, postRetRatePct: 8
    });
    check("depletion of exactly-required corpus ends ≈ 0",
      Math.abs(dep.finalBalance) < rc * 0.001 && dep.runsOutAge === null);
    var depShort = depletionSchedule({
      corpus: rc * 0.7, retireAge: 60, lifeExpectancy: 85,
      firstYearAnnualExpense: 1200000, inflationPct: 6, postRetRatePct: 8
    });
    check("under-funded corpus runs out early", depShort.runsOutAge !== null && depShort.runsOutAge < 85);

    // SWP
    var msw = maxSustainableWithdrawal({ corpus: 10000000, annualRatePct: 9, stepUpPct: 5, years: 25 });
    var simOk = swpSimulate({ corpus: 10000000, monthlyWithdrawal: msw * 0.999, annualRatePct: 9, stepUpPct: 5, years: 25 });
    var simBad = swpSimulate({ corpus: 10000000, monthlyWithdrawal: msw * 1.02, annualRatePct: 9, stepUpPct: 5, years: 25 });
    check("maxSustainableWithdrawal survives", simOk.depletedAtMonth === null);
    check("2% above max depletes", simBad.depletedAtMonth !== null);
    check("SWP stops withdrawing after depletion",
      simBad.totalWithdrawn < msw * 1.02 * 12 * 25 * 2);

    // NPS
    var nps = npsProject({ currentAge: 30, retireAge: 60, monthly: 10000, annualRatePct: 10, annuityPct: 40, annuityRatePct: 6, stepUpPct: 0 });
    check("NPS corpus = sipFV", approx(nps.corpus, sipFV(10000, 10, 30), 1e-6));
    check("NPS split sums to corpus", approx(nps.annuityAmt + nps.lumpSum, nps.corpus, 1e-6));
    check("NPS pension = annuity×rate/12",
      approx(nps.monthlyPension, nps.annuityAmt * 0.06 / 12, 1e-9));

    // FIRE
    var ft = fireTargets(50000, 6, 20);
    check("FIRE tiers ordered lean<standard<comfortable",
      ft.lean < ft.standard && ft.standard < ft.comfortable);
    check("FIRE standard = 25× inflated annual",
      approx(ft.standard, inflate(600000, 6, 20) * 25, 1e-9));
    var fy = fireFreedomYear({ monthlyExpenseToday: 50000, inflationPct: 6, ratePct: 12, currentCorpus: 2000000, monthlySip: 50000, stepUpPct: 10, multiple: 25 });
    check("fireFreedomYear returns a plausible year", fy !== null && fy > 5 && fy < 40);

    return t;
  }

  var api = {
    fvLumpsum: fvLumpsum,
    pvLumpsum: pvLumpsum,
    sipFV: sipFV,
    requiredSip: requiredSip,
    stepUpSipFV: stepUpSipFV,
    requiredStepUpSip: requiredStepUpSip,
    sipSchedule: sipSchedule,
    todaysValue: todaysValue,
    inflate: inflate,
    cagr: cagr,
    emi: emi,
    simpleInterestFV: simpleInterestFV,
    compoundFV: compoundFV,
    effectiveAnnualRate: effectiveAnnualRate,
    lumpsumSchedule: lumpsumSchedule,
    amortize: amortize,
    requiredCorpus: requiredCorpus,
    depletionSchedule: depletionSchedule,
    retirementPlan: retirementPlan,
    swpSimulate: swpSimulate,
    maxSustainableWithdrawal: maxSustainableWithdrawal,
    npsProject: npsProject,
    fireTargets: fireTargets,
    fireFreedomYear: fireFreedomYear,
    formatINR: formatINR,
    formatINRCompact: formatINRCompact,
    formatPct: formatPct,
    selfTest: selfTest
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
    if (typeof process !== "undefined" && process.argv.indexOf("--test") !== -1) {
      var results = selfTest();
      var failed = results.filter(function (r) { return !r.pass; });
      results.forEach(function (r) {
        console.log((r.pass ? "PASS" : "FAIL") + "  " + r.name);
      });
      console.log(failed.length === 0
        ? "\nAll " + results.length + " engine tests passed."
        : "\n" + failed.length + " TEST(S) FAILED.");
      process.exit(failed.length === 0 ? 0 : 1);
    }
  } else {
    root.ProFin = api;
  }
})(typeof self !== "undefined" ? self : this);
