"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CustomerAccount = {
  id: string;
  customer_id?: number | null;
  customer_name: string;
  customer_phone: string;
  total_credit_given: number | string;
  total_credit_paid: number | string;
  current_balance: number | string;
  next_due_date?: string | null;
  last_credit_date?: string | null;
  last_payment_date?: string | null;
};

type CustomerTransaction = {
  id: number;
  credit_account_id: string;
  transaction_type: string;
  amount_change: number | string;
  balance_before: number | string;
  balance_after: number | string;
  payment_method?: string | null;
  reference_number?: string | null;
  description?: string | null;
  created_at: string;
};

type Supplier = {
  id: number;
  supplier_name: string;
  phone?: string | null;
  city?: string | null;
  gst_number?: string | null;
  total_purchase_amount: number | string;
  total_paid_amount: number | string;
  current_balance: number | string;
};

type Purchase = {
  id: string;
  purchase_number?: string | null;
  supplier_id: number;
  purchase_date: string;
  total_amount: number | string;
  paid_amount: number | string;
  due_amount: number | string;
  payment_status?: string | null;
  due_date?: string | null;
};

type SupplierPayment = {
  id: number;
  supplier_id: number;
  purchase_id?: string | null;
  payment_date: string;
  amount: number | string;
  payment_method: string;
};

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

function n(value: number | string | null | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function dateText(value?: string | null) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function PartyLedgersPage() {
  const [tab, setTab] = useState<"customers" | "suppliers">("customers");
  const [customers, setCustomers] = useState<CustomerAccount[]>([]);
  const [customerTransactions, setCustomerTransactions] = useState<CustomerTransaction[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [c, ct, s, p, sp] = await Promise.all([
        supabase.from("customer_credit_accounts").select("*").eq("is_active", true).order("current_balance", { ascending: false }),
        supabase.from("customer_credit_transactions").select("*").order("created_at", { ascending: false }).limit(1000),
        supabase.from("suppliers").select("*").eq("is_active", true).order("current_balance", { ascending: false }),
        supabase.from("purchases").select("id,purchase_number,supplier_id,purchase_date,total_amount,paid_amount,due_amount,payment_status,due_date").is("deleted_at", null).order("purchase_date", { ascending: false }).limit(1000),
        supabase.from("supplier_payments").select("*").order("payment_date", { ascending: false }).limit(1000),
      ]);
      if (c.error) throw c.error;
      if (ct.error) throw ct.error;
      if (s.error) throw s.error;
      if (p.error) throw p.error;
      if (sp.error) throw sp.error;

      const cRows = (c.data || []) as CustomerAccount[];
      const sRows = (s.data || []) as Supplier[];
      setCustomers(cRows);
      setCustomerTransactions((ct.data || []) as CustomerTransaction[]);
      setSuppliers(sRows);
      setPurchases((p.data || []) as Purchase[]);
      setSupplierPayments((sp.data || []) as SupplierPayment[]);

      if (!selectedCustomerId && cRows[0]) setSelectedCustomerId(cRows[0].id);
      if (!selectedSupplierId && sRows[0]) setSelectedSupplierId(sRows[0].id);
    } catch (error) {
      console.error(error);
      setNotice(error instanceof Error ? error.message : "Unable to load ledgers.");
    } finally {
      setLoading(false);
    }
  }, [selectedCustomerId, selectedSupplierId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const selectedCustomer = customers.find((x) => x.id === selectedCustomerId);
  const selectedSupplier = suppliers.find((x) => x.id === Number(selectedSupplierId));

  const customerStatement = customerTransactions.filter(
    (x) => x.credit_account_id === selectedCustomerId,
  );

  const supplierPurchases = purchases.filter(
    (x) => x.supplier_id === Number(selectedSupplierId),
  );

  const selectedSupplierPayments = supplierPayments.filter(
    (x) => x.supplier_id === Number(selectedSupplierId),
  );

  const receivable = customers.reduce((sum, x) => sum + Math.max(0, n(x.current_balance)), 0);
  const payable = suppliers.reduce((sum, x) => sum + Math.max(0, n(x.current_balance)), 0);

  const filteredCustomers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return customers.filter((x) =>
      !q || `${x.customer_name} ${x.customer_phone}`.toLowerCase().includes(q),
    );
  }, [customers, search]);

  const filteredSuppliers = useMemo(() => {
    const q = search.toLowerCase().trim();
    return suppliers.filter((x) =>
      !q || `${x.supplier_name} ${x.phone || ""} ${x.city || ""}`.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  async function recordPayment(event: FormEvent) {
    event.preventDefault();
    const value = n(amount);
    if (value <= 0) return setNotice("Enter a valid payment amount.");

    setSaving(true);
    try {
      if (tab === "customers") {
        if (!selectedCustomer) throw new Error("Select a customer.");
        const { error } = await supabase.rpc("ncs_record_customer_due_collection", {
          p_credit_account_id: selectedCustomer.id,
          p_amount: value,
          p_payment_method: method,
          p_reference_number: reference.trim() || null,
          p_notes: notes.trim() || null,
        });
        if (error) throw error;
      } else {
        if (!selectedSupplier) throw new Error("Select a supplier.");
        const { error } = await supabase.rpc("ncs_record_supplier_payment", {
          p_supplier_id: selectedSupplier.id,
          p_amount: value,
          p_payment_date: new Date().toISOString().slice(0, 10),
          p_payment_method: method,
          p_purchase_id: null,
        });
        if (error) throw error;
      }

      setAmount("");
      setReference("");
      setNotes("");
      setNotice(tab === "customers" ? "Customer payment received." : "Supplier payment saved.");
      await loadData();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Payment failed.");
    } finally {
      setSaving(false);
    }
  }

  function printStatement() {
    window.print();
  }

  function shareStatement() {
    const party = tab === "customers" ? selectedCustomer?.customer_name : selectedSupplier?.supplier_name;
    const balance = tab === "customers" ? n(selectedCustomer?.current_balance) : n(selectedSupplier?.current_balance);
    const message = `NEW CITY STYLE\n${tab === "customers" ? "Customer Receivable" : "Supplier Payable"} Statement\nParty: ${party || "—"}\nCurrent Balance: ${money(balance)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <main className="ledgerPage">
      <header className="hero">
        <div>
          <span>NEW CITY STYLE • PARTY ACCOUNTS</span>
          <h1>Customer &amp; Supplier Ledgers</h1>
          <p>Receivables, payables, payments and party-wise statements in one premium control centre.</p>
        </div>
        <button onClick={() => void loadData()}>{loading ? "Refreshing..." : "↻ Refresh"}</button>
      </header>

      {notice && <div className="notice">{notice}</div>}

      <section className="kpis">
        <article><span>TOTAL RECEIVABLE</span><strong>{money(receivable)}</strong><small>{customers.filter(x => n(x.current_balance) > 0).length} customers pending</small></article>
        <article><span>TOTAL PAYABLE</span><strong>{money(payable)}</strong><small>{suppliers.filter(x => n(x.current_balance) > 0).length} suppliers pending</small></article>
        <article><span>NET POSITION</span><strong>{money(receivable - payable)}</strong><small>Receivable minus payable</small></article>
      </section>

      <div className="tabs">
        <button className={tab === "customers" ? "active" : ""} onClick={() => setTab("customers")}>👥 Customer Ledger</button>
        <button className={tab === "suppliers" ? "active" : ""} onClick={() => setTab("suppliers")}>🚚 Supplier Ledger</button>
      </div>

      <section className="workspace">
        <aside className="partyPanel">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search party..." />
          <div className="partyList">
            {(tab === "customers" ? filteredCustomers : filteredSuppliers).map((party) => {
              const customer = tab === "customers" ? party as CustomerAccount : null;
              const supplier = tab === "suppliers" ? party as Supplier : null;
              const active = customer ? selectedCustomerId === customer.id : Number(selectedSupplierId) === supplier?.id;
              return (
                <button
                  key={customer?.id || supplier?.id}
                  className={active ? "party activeParty" : "party"}
                  onClick={() => customer ? setSelectedCustomerId(customer.id) : setSelectedSupplierId(supplier!.id)}
                >
                  <div><strong>{customer?.customer_name || supplier?.supplier_name}</strong><span>{customer?.customer_phone || supplier?.phone || "No phone"}</span></div>
                  <b>{money(n(customer?.current_balance ?? supplier?.current_balance))}</b>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="statementPanel">
          <div className="partyHeader">
            <div>
              <span>{tab === "customers" ? "CUSTOMER RECEIVABLE" : "SUPPLIER PAYABLE"}</span>
              <h2>{tab === "customers" ? selectedCustomer?.customer_name : selectedSupplier?.supplier_name || "Select a party"}</h2>
              <p>{tab === "customers" ? selectedCustomer?.customer_phone : selectedSupplier?.phone || ""}</p>
            </div>
            <div className="balance"><span>CURRENT BALANCE</span><strong>{money(n(tab === "customers" ? selectedCustomer?.current_balance : selectedSupplier?.current_balance))}</strong></div>
          </div>

          <div className="actions">
            <button onClick={printStatement}>🖨 Print</button>
            <button onClick={shareStatement}>💬 WhatsApp</button>
          </div>

          <div className="statementList">
            {tab === "customers" ? customerStatement.map((x) => (
              <article key={x.id}>
                <div><strong>{x.description || x.transaction_type}</strong><span>{new Date(x.created_at).toLocaleString("en-IN")} • {x.payment_method || "credit"}</span></div>
                <div className={n(x.amount_change) < 0 ? "credit" : "debit"}><b>{n(x.amount_change) < 0 ? "-" : "+"}{money(Math.abs(n(x.amount_change)))}</b><small>Balance {money(n(x.balance_after))}</small></div>
              </article>
            )) : (
              [...supplierPurchases.map(x => ({ id: `p-${x.id}`, date: x.purchase_date, title: x.purchase_number || "Purchase", amount: n(x.total_amount), direction: "out" })),
               ...selectedSupplierPayments.map(x => ({ id: `sp-${x.id}`, date: x.payment_date, title: "Supplier Payment", amount: n(x.amount), direction: "in" }))]
                .sort((a,b) => b.date.localeCompare(a.date))
                .map(x => (
                  <article key={x.id}>
                    <div><strong>{x.title}</strong><span>{dateText(x.date)}</span></div>
                    <div className={x.direction === "in" ? "credit" : "debit"}><b>{x.direction === "in" ? "-" : "+"}{money(x.amount)}</b></div>
                  </article>
                ))
            )}
          </div>
        </section>

        <form className="paymentPanel" onSubmit={recordPayment}>
          <span>{tab === "customers" ? "RECEIVE PAYMENT" : "PAY SUPPLIER"}</span>
          <h2>Record Payment</h2>
          <label>Amount<input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label>Payment Method<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="bank_transfer">Bank Transfer</option></select></label>
          <label>Reference<input value={reference} onChange={(e) => setReference(e.target.value)} /></label>
          <label>Notes<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          <button disabled={saving}>{saving ? "Saving..." : tab === "customers" ? "Receive Customer Payment" : "Save Supplier Payment"}</button>
        </form>
      </section>

      <style jsx global>{`
        *{box-sizing:border-box}.ledgerPage{min-height:100vh;padding:24px;background:${IVORY};font-family:Poppins,Inter,Arial,sans-serif;color:#2c2c2c}
        .hero{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;padding:24px;border:1px solid rgba(212,175,55,.35);border-radius:22px;background:radial-gradient(circle at 90% 0%,rgba(212,175,55,.25),transparent 34%),linear-gradient(135deg,${DEEP},${BLUE});color:white;box-shadow:0 18px 45px rgba(3,21,63,.18)}
        .hero span,.paymentPanel>span,.partyHeader>div>span{color:${GOLD};font-size:9px;font-weight:950;letter-spacing:1px}.hero h1{margin:5px 0 0;font-size:31px}.hero p{margin:6px 0 0;color:#ffffffb8;font-size:10px}.hero button,.actions button{min-height:40px;padding:0 14px;border:1px solid ${GOLD};border-radius:10px;background:${GOLD};color:${BLUE};font-weight:900;cursor:pointer}
        .notice{margin-top:12px;padding:11px;border-radius:10px;background:#fff7df;color:#775d11;font-size:10px;font-weight:800}
        .kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:15px 0}.kpis article{padding:18px;border-radius:18px;background:linear-gradient(135deg,${BLUE},${DEEP});color:white}.kpis span,.kpis strong,.kpis small{display:block}.kpis span{color:${GOLD};font-size:8px;font-weight:950}.kpis strong{margin-top:7px;font-size:24px}.kpis small{margin-top:5px;color:#ffffffa8;font-size:8px}
        .tabs{display:flex;gap:8px;margin-bottom:12px}.tabs button{padding:11px 16px;border:1px solid #dce2eb;border-radius:11px;background:white;color:${BLUE};font-weight:850;cursor:pointer}.tabs .active{border-color:${GOLD};background:${BLUE};color:white}
        .workspace{display:grid;grid-template-columns:260px minmax(0,1fr) 290px;gap:13px}.partyPanel,.statementPanel,.paymentPanel{border:1px solid #e1e6ed;border-radius:18px;background:white;box-shadow:0 10px 28px rgba(10,46,115,.07)}.partyPanel{padding:12px}.partyPanel input{width:100%;min-height:42px;padding:0 10px;border:1px solid #dce2eb;border-radius:10px}.partyList{display:grid;gap:7px;max-height:650px;margin-top:10px;overflow:auto}.party{display:flex;justify-content:space-between;align-items:center;gap:8px;width:100%;padding:11px;border:1px solid #e3e7ed;border-radius:11px;background:#fff;text-align:left;cursor:pointer}.party strong,.party span{display:block}.party strong{color:${BLUE};font-size:10px}.party span{margin-top:3px;color:#7b8491;font-size:8px}.party b{color:${BLUE};font-size:10px}.activeParty{border-color:${GOLD};background:#fff9e8}
        .statementPanel{overflow:hidden}.partyHeader{display:flex;justify-content:space-between;gap:16px;padding:18px;border-bottom:1px solid #edf0f4}.partyHeader h2{margin:5px 0 0;color:${BLUE};font-size:20px}.partyHeader p{margin:4px 0 0;color:#7b8491;font-size:9px}.balance{text-align:right}.balance strong{display:block;margin-top:5px;color:${BLUE};font-size:20px}.actions{display:flex;gap:7px;padding:10px 18px;background:#f8fafc}.actions button{min-height:34px;font-size:8px}.statementList{display:grid;gap:7px;padding:12px;max-height:570px;overflow:auto;background:#f8fafc}.statementList article{display:flex;justify-content:space-between;gap:15px;padding:12px;border:1px solid #e5e9ef;border-radius:11px;background:white}.statementList strong,.statementList span,.statementList b,.statementList small{display:block}.statementList strong{color:${BLUE};font-size:10px}.statementList span,.statementList small{margin-top:3px;color:#7b8491;font-size:8px}.statementList>article>div:last-child{text-align:right}.credit b{color:#067647}.debit b{color:#b42318}
        .paymentPanel{align-self:start;position:sticky;top:18px;padding:17px}.paymentPanel h2{margin:5px 0 15px;color:${BLUE};font-size:19px}.paymentPanel label{display:block;margin-top:9px;color:#667085;font-size:8px;font-weight:850}.paymentPanel input,.paymentPanel select,.paymentPanel textarea{width:100%;margin-top:5px;border:1px solid #dce2eb;border-radius:9px;background:#fbfcfe;font:inherit}.paymentPanel input,.paymentPanel select{min-height:40px;padding:0 9px}.paymentPanel textarea{min-height:75px;padding:9px}.paymentPanel>button{width:100%;min-height:44px;margin-top:12px;border:1px solid ${GOLD};border-radius:10px;background:linear-gradient(135deg,${BLUE},${DEEP});color:white;font-weight:900;cursor:pointer}
        @media(max-width:1180px){.workspace{grid-template-columns:240px minmax(0,1fr)}.paymentPanel{grid-column:1/-1;position:static}.kpis{grid-template-columns:1fr 1fr 1fr}}@media(max-width:760px){.ledgerPage{padding:12px 8px 30px}.hero{align-items:stretch;flex-direction:column}.kpis,.workspace{grid-template-columns:1fr}.tabs{display:grid;grid-template-columns:1fr 1fr}.partyList{max-height:300px}.partyHeader{flex-direction:column}.balance{text-align:left}}
        @media print{.hero,.kpis,.tabs,.partyPanel,.paymentPanel,.actions,.notice{display:none!important}.ledgerPage{padding:0;background:white}.workspace{display:block}.statementPanel{box-shadow:none;border:0}.statementList{max-height:none;overflow:visible}}
      `}</style>
    </main>
  );
}