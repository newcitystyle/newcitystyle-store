"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const BLUE = "#0A2E73";
const DEEP = "#03153F";
const GOLD = "#D4AF37";
const IVORY = "#F8F4EC";

type Tab = "thermal" | "a4" | "whatsapp";
type Theme = "signature" | "minimal" | "counter";

type Settings = {
  id: string;
  active_tab: Tab;
  theme: Theme;
  thermal_width: 58 | 80;
  copies: number;
  bold_text: boolean;
  auto_cut: boolean;
  cash_drawer: boolean;
  show_logo: boolean;
  show_address: boolean;
  show_phone: boolean;
  show_email: boolean;
  show_gstin: boolean;
  show_bank: boolean;
  show_upi_qr: boolean;
  show_terms: boolean;
  footer_message: string;
  terms_text: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  upi_id: string;
};

type Business = {
  name: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
};

const defaults: Settings = {
  id: "default",
  active_tab: "thermal",
  theme: "signature",
  thermal_width: 80,
  copies: 1,
  bold_text: true,
  auto_cut: false,
  cash_drawer: false,
  show_logo: true,
  show_address: true,
  show_phone: true,
  show_email: true,
  show_gstin: true,
  show_bank: false,
  show_upi_qr: true,
  show_terms: true,
  footer_message: "Thank you for shopping with NEW CITY STYLE.",
  terms_text: "Exchange subject to store policy. Please retain your bill.",
  bank_name: "",
  account_number: "",
  ifsc_code: "",
  upi_id: "",
};

const emptyBusiness: Business = {
  name: "NEW CITY STYLE",
  logo: "",
  address: "",
  phone: "",
  email: "",
  gstin: "",
};

function pick(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

function Toggle({
  title,
  hint,
  value,
  onChange,
}: {
  title: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      className={`studioToggle ${value ? "on" : ""}`}
      onClick={() => onChange(!value)}
    >
      <span>
        <strong>{title}</strong>
        <small>{hint}</small>
      </span>
      <i><b /></i>
    </button>
  );
}

export default function InvoiceStudioPage() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [business, setBusiness] = useState<Business>(emptyBusiness);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const patch = (next: Partial<Settings>) =>
    setSettings((current) => ({ ...current, ...next }));

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [invoice, branding, store] = await Promise.all([
        supabase
          .from("ncs_invoice_settings")
          .select("*")
          .eq("id", "default")
          .maybeSingle(),
        supabase.from("branding_settings").select("*").limit(1).maybeSingle(),
        supabase.from("store_settings").select("*").limit(1).maybeSingle(),
      ]);

      if (!mounted) return;

      if (invoice.data) {
        setSettings({
          ...defaults,
          ...(invoice.data as Partial<Settings>),
          thermal_width: Number(invoice.data.thermal_width) === 58 ? 58 : 80,
          copies: Math.min(3, Math.max(1, Number(invoice.data.copies || 1))),
        });
      }

      const b = (branding.data || {}) as Record<string, unknown>;
      const s = (store.data || {}) as Record<string, unknown>;
      setBusiness({
        name: pick(s.store_name, s.business_name, b.store_name, b.business_name, "NEW CITY STYLE"),
        logo: pick(b.logo_url, s.logo_url),
        address: pick(s.address, s.store_address, s.business_address, b.store_address),
        phone: pick(b.store_phone, s.phone, s.store_phone),
        email: pick(b.store_email, s.email, s.store_email),
        gstin: pick(s.gstin, s.gst_number, b.gstin),
      });

      setLoading(false);
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  async function save() {
    setSaving(true);
    setMessage("");
    const { error } = await supabase
      .from("ncs_invoice_settings")
      .upsert({ ...settings, updated_at: new Date().toISOString() }, { onConflict: "id" });

    if (error) {
      console.error(error);
      setMessage("Settings save కాలేదు. ముందుగా Invoice Studio SQL run చేయండి.");
    } else {
      setMessage("Invoice & Printer settings saved.");
    }
    setSaving(false);
  }

  const sample = useMemo(
    () => ({
      no: "NCS-240810-001",
      customer: "Walk-in Customer",
      items: [
        ["Premium Shirt", 1, 799],
        ["Comfort Trouser", 1, 1099],
      ] as const,
      subtotal: 1898,
      discount: 98,
      total: 1800,
    }),
    [],
  );

  const upiPaymentUrl = useMemo(() => {
    const upi = settings.upi_id.trim();
    if (!upi) return "";
    const params = new URLSearchParams({
      pa: upi,
      pn: business.name || "NEW CITY STYLE",
      cu: "INR",
    });
    return `upi://pay?${params.toString()}`;
  }, [settings.upi_id, business.name]);

  const upiQrImageUrl = useMemo(
    () =>
      upiPaymentUrl
        ? `https://api.qrserver.com/v1/create-qr-code/?size=700x700&margin=18&data=${encodeURIComponent(
            upiPaymentUrl
          )}`
        : "",
    [upiPaymentUrl]
  );

  const whatsappInvoiceText = useMemo(
    () =>
      [
        `*${business.name || "NEW CITY STYLE"}*`,
        "Style for Every Family",
        "",
        `Invoice: ${sample.no}`,
        `Customer: ${sample.customer}`,
        `Total Paid: ${money(sample.total)}`,
        "Payment: UPI",
        "",
        settings.footer_message ||
          "Thank you for shopping with NEW CITY STYLE.",
      ].join("\n"),
    [
      business.name,
      sample.no,
      sample.customer,
      sample.total,
      settings.footer_message,
    ]
  );

  return (
    <main className="studioPage">
      <section className="studioHero">
        <div>
          <span>NCS BUSINESS CONTROL STUDIO</span>
          <h1>Invoice & Printer Studio</h1>
          <p>Thermal, A4, WhatsApp invoice look — ఒకే చోట simpleగా control చేయండి.</p>
        </div>
        <div className="heroActions">
          <em><i /> LIVE PREVIEW</em>
          <button onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save Studio"}
          </button>
        </div>
      </section>

      <section className="modeTabs">
        {([
          ["thermal", "THERMAL", "Fast counter receipt"],
          ["a4", "A4 PREMIUM", "Full-size invoice"],
          ["whatsapp", "WHATSAPP", "Share-friendly bill"],
        ] as const).map(([value, title, sub]) => (
          <button
            key={value}
            className={settings.active_tab === value ? "active" : ""}
            onClick={() => patch({ active_tab: value })}
          >
            <strong>{title}</strong>
            <small>{sub}</small>
          </button>
        ))}
      </section>

      {message && <div className="studioNotice">{message}</div>}

      <section className="workspace">
        <div className="controls">
          <section className="panel">
            <div className="panelTitle"><b>01</b><div><h2>Choose the feel</h2><p>Three practical NCS styles — no clutter.</p></div></div>
            <div className="themeGrid">
              {([
                ["signature", "NCS Signature", "Royal blue + gold"],
                ["minimal", "Clean Minimal", "Fast & readable"],
                ["counter", "Counter Compact", "Small paper friendly"],
              ] as const).map(([value, title, sub]) => (
                <button
                  key={value}
                  className={settings.theme === value ? "active" : ""}
                  onClick={() => patch({ theme: value })}
                >
                  <i><span /><span /><span /></i>
                  <strong>{title}</strong>
                  <small>{sub}</small>
                </button>
              ))}
            </div>
          </section>

          {settings.active_tab === "thermal" && (
            <section className="panel">
              <div className="panelTitle"><b>02</b><div><h2>Printer comfort</h2><p>Counterలో ఒక్కసారి set చేస్తే చాలు.</p></div></div>
              <div className="segment">
                <button className={settings.thermal_width === 58 ? "active" : ""} onClick={() => patch({ thermal_width: 58 })}>58 mm<small>Compact</small></button>
                <button className={settings.thermal_width === 80 ? "active" : ""} onClick={() => patch({ thermal_width: 80 })}>80 mm<small>Recommended</small></button>
              </div>
              <div className="copies"><span><strong>Copies</strong><small>1–3 copies per print</small></span><div><button onClick={() => patch({ copies: Math.max(1, settings.copies - 1) })}>−</button><b>{settings.copies}</b><button onClick={() => patch({ copies: Math.min(3, settings.copies + 1) })}>+</button></div></div>
              <Toggle title="Bold counter text" hint="Small receiptలో clearer reading" value={settings.bold_text} onChange={(bold_text) => patch({ bold_text })} />
              <Toggle title="Auto cut" hint="Supported printer ఉంటే ఉపయోగించండి" value={settings.auto_cut} onChange={(auto_cut) => patch({ auto_cut })} />
              <Toggle title="Cash drawer" hint="Print తర్వాత drawer trigger" value={settings.cash_drawer} onChange={(cash_drawer) => patch({ cash_drawer })} />
            </section>
          )}

          <section className="panel">
            <div className="panelTitle"><b>{settings.active_tab === "thermal" ? "03" : "02"}</b><div><h2>Customer sees</h2><p>Billలో అవసరమైనవి మాత్రమే.</p></div></div>
            <div className="toggleGrid">
              <Toggle title="Logo" hint="Brand identity" value={settings.show_logo} onChange={(show_logo) => patch({ show_logo })} />
              <Toggle title="Address" hint="Store location" value={settings.show_address} onChange={(show_address) => patch({ show_address })} />
              <Toggle title="Phone" hint="Customer support" value={settings.show_phone} onChange={(show_phone) => patch({ show_phone })} />
              <Toggle title="Email" hint="Digital contact" value={settings.show_email} onChange={(show_email) => patch({ show_email })} />
              <Toggle title="GSTIN" hint="Only if configured" value={settings.show_gstin} onChange={(show_gstin) => patch({ show_gstin })} />
              <Toggle title="UPI QR" hint="Faster payment" value={settings.show_upi_qr} onChange={(show_upi_qr) => patch({ show_upi_qr })} />
              <Toggle title="Bank details" hint="Optional" value={settings.show_bank} onChange={(show_bank) => patch({ show_bank })} />
              <Toggle title="Terms" hint="Exchange / policy note" value={settings.show_terms} onChange={(show_terms) => patch({ show_terms })} />
            </div>
          </section>

          <section className="panel">
            <div className="panelTitle"><b>{settings.active_tab === "thermal" ? "04" : "03"}</b><div><h2>Final message</h2><p>Customerకి friendly finishing.</p></div></div>
            <label><span>Footer message</span><input value={settings.footer_message} onChange={(e) => patch({ footer_message: e.target.value })} /></label>
            <label><span>Terms / exchange note</span><textarea rows={3} value={settings.terms_text} onChange={(e) => patch({ terms_text: e.target.value })} /></label>
            <div className="twoFields">
              <label><span>UPI ID</span><input placeholder="shop@upi" value={settings.upi_id} onChange={(e) => patch({ upi_id: e.target.value })} /></label>
              <label><span>Bank name</span><input placeholder="Optional" value={settings.bank_name} onChange={(e) => patch({ bank_name: e.target.value })} /></label>
            </div>
            <div className="twoFields">
              <label><span>Account number</span><input placeholder="Optional" value={settings.account_number} onChange={(e) => patch({ account_number: e.target.value })} /></label>
              <label><span>IFSC code</span><input placeholder="Optional" value={settings.ifsc_code} onChange={(e) => patch({ ifsc_code: e.target.value.toUpperCase() })} /></label>
            </div>
          </section>
        </div>

        <aside className="previewCard">
          <header><div><span>LIVE BILL PREVIEW</span><strong>{settings.active_tab === "thermal" ? `${settings.thermal_width}mm Thermal` : settings.active_tab === "a4" ? "A4 Premium" : "WhatsApp Share"}</strong></div><button onClick={() => window.print()}>Test Print</button></header>
          <div className="stage">
            <article
              className={`invoice theme-${settings.theme} mode-${settings.active_tab} ${
                settings.active_tab === "thermal" ? `thermal-${settings.thermal_width}` : ""
              }`}
              style={{
                fontWeight:
                  settings.bold_text && settings.active_tab === "thermal" ? 650 : 500,
              }}
            >
              {settings.active_tab === "a4" ? (
                <>
                  <div className="a4Masthead">
                    <div className="a4Identity">
                      {settings.show_logo && (
                        <div className="a4Mark">
                          {business.logo ? <img src={business.logo} alt="NCS" /> : <span>NCS</span>}
                        </div>
                      )}
                      <div className="a4BrandText">
                        <h2>{business.name || "NEW CITY STYLE"}</h2>
                        <small>STYLE FOR EVERY FAMILY</small>
                        {settings.show_address && business.address && <p>{business.address}</p>}
                        <div className="a4Contacts">
                          {settings.show_phone && business.phone && <span>{business.phone}</span>}
                          {settings.show_email && business.email && <span>{business.email}</span>}
                          {settings.show_gstin && business.gstin && <span>GSTIN: {business.gstin}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="a4InvoiceType">
                      <b>RETAIL INVOICE</b>
                      <small>
                        {settings.theme === "signature"
                          ? "NCS Signature"
                          : settings.theme === "minimal"
                            ? "Clean Minimal"
                            : "Counter Compact"}
                      </small>
                    </div>
                  </div>

                  <div className="a4GoldRule" />

                  <div className="a4MetaGrid">
                    <div className="a4CustomerCard">
                      <span>BILLED TO</span>
                      <strong>{sample.customer}</strong>
                      <small>+91 90000 00000</small>
                    </div>
                    <div className="a4BillCard">
                      <p><span>INVOICE</span><b>{sample.no}</b></p>
                      <p><span>DATE</span><b>10 Aug 2026</b></p>
                      <p><span>PAYMENT</span><b>UPI</b></p>
                    </div>
                  </div>

                  <div className="items premiumItems">
                    <div className="head"><span>ITEM</span><span>QTY</span><span>AMOUNT</span></div>
                    {sample.items.map(([name, qty, amount]) => (
                      <div className="row" key={name}>
                        <span>{name}</span><span>{qty}</span><span>{money(amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="a4BottomGrid">
                    <div>
                      {(settings.show_upi_qr || settings.show_bank) && (
                        <div className="payBox a4PayBox">
                          {settings.show_upi_qr && (
                            <div className="qr">
                              {upiQrImageUrl ? <img src={upiQrImageUrl} alt="UPI QR" /> : <><b>UPI</b><small>Set ID</small></>}
                            </div>
                          )}
                          <div>
                            {settings.show_upi_qr && <><b>Scan & Pay</b><small>{settings.upi_id || "Set your UPI ID"}</small></>}
                            {settings.show_bank && (
                              <>
                                <small>{settings.bank_name || "Bank details"}</small>
                                {settings.account_number && <small>A/C {settings.account_number}</small>}
                                {settings.ifsc_code && <small>IFSC {settings.ifsc_code}</small>}
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="totals a4Totals">
                      <p><span>Subtotal</span><b>{money(sample.subtotal)}</b></p>
                      <p><span>Discount</span><b>− {money(sample.discount)}</b></p>
                      <p className="grand"><span>TOTAL PAID</span><b>{money(sample.total)}</b></p>
                      <small>GST, where applicable, is included in the selling price.</small>
                    </div>
                  </div>

                  {settings.show_terms && settings.terms_text && <div className="terms">{settings.terms_text}</div>}
                  <footer><b>{settings.footer_message}</b><small>Powered by NCS Billing</small></footer>
                </>
              ) : settings.active_tab === "thermal" ? (
                <>
                  <div className="thermalBrand">
                    {settings.show_logo && (
                      <div className="thermalLogo">
                        {business.logo ? <img src={business.logo} alt="NCS" /> : <span>NCS</span>}
                      </div>
                    )}
                    <h2>{business.name || "NEW CITY STYLE"}</h2>
                    <small>STYLE FOR EVERY FAMILY</small>
                    <i />
                    {settings.show_address && business.address && <p>{business.address}</p>}
                    {settings.show_phone && business.phone && <p>Ph / WhatsApp: {business.phone}</p>}
                    {settings.show_email && business.email && <p>{business.email}</p>}
                    {settings.show_gstin && business.gstin && <p>GSTIN: {business.gstin}</p>}
                  </div>

                  <div className="thermalDivider" />
                  <div className="thermalMeta">
                    <p><span>Invoice</span><b>{sample.no}</b></p>
                    <p><span>Customer</span><b>{sample.customer}</b></p>
                    <p><span>Payment</span><b>UPI</b></p>
                    <p><span>Date</span><b>10 Aug 2026</b></p>
                  </div>

                  <div className="items thermalItems">
                    <div className="head"><span>ITEM</span><span>QTY</span><span>AMOUNT</span></div>
                    {sample.items.map(([name, qty, amount]) => (
                      <div className="row" key={name}>
                        <span>{name}</span><span>{qty}</span><span>{money(amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="thermalTotals">
                    <p><span>Subtotal</span><b>{money(sample.subtotal)}</b></p>
                    <p><span>Discount</span><b>− {money(sample.discount)}</b></p>
                    <p className="grand"><span>TOTAL</span><b>{money(sample.total)}</b></p>
                    <small>Paid: {money(sample.total)}</small>
                  </div>

                  {(settings.show_upi_qr || settings.show_bank) && (
                    <div className="thermalPay">
                      {settings.show_upi_qr && (
                        <div className="qr">
                          {upiQrImageUrl ? <img src={upiQrImageUrl} alt="UPI QR" /> : <><b>UPI</b><small>Set ID</small></>}
                        </div>
                      )}
                      {settings.show_upi_qr && <><b>SCAN & PAY</b><small>{settings.upi_id || "Set your UPI ID"}</small></>}
                      {settings.show_bank && <small>{settings.bank_name || "Bank details"}</small>}
                    </div>
                  )}

                  {settings.show_terms && settings.terms_text && <div className="terms">{settings.terms_text}</div>}
                  <div className="thermalStatus">PAYMENT RECEIVED</div>
                  <footer><b>{settings.footer_message}</b><small>Powered by NCS Billing</small></footer>
                </>
              ) : (
                <>
                  <div className="brand">
                    {settings.show_logo && <div className="logo">{business.logo ? <img src={business.logo} alt="NCS" /> : <span>NCS</span>}</div>}
                    <div><h2>{business.name}</h2><small>STYLE FOR EVERY FAMILY</small></div>
                  </div>
                  <div className="businessInfo">
                    {settings.show_address && business.address && <span>{business.address}</span>}
                    {settings.show_phone && business.phone && <span>Phone: {business.phone}</span>}
                    {settings.show_email && business.email && <span>{business.email}</span>}
                    {settings.show_gstin && business.gstin && <span>GSTIN: {business.gstin}</span>}
                  </div>
                  <hr />
                  <div className="meta"><div><span>Invoice</span><b>{sample.no}</b></div><div><span>Customer</span><b>{sample.customer}</b></div><div><span>Payment</span><b>UPI</b></div></div>
                  <div className="items"><div className="head"><span>ITEM</span><span>QTY</span><span>AMOUNT</span></div>{sample.items.map(([name, qty, amount]) => <div className="row" key={name}><span>{name}</span><span>{qty}</span><span>{money(amount)}</span></div>)}</div>
                  <div className="totals"><p><span>Subtotal</span><b>{money(sample.subtotal)}</b></p><p><span>Discount</span><b>− {money(sample.discount)}</b></p><p className="grand"><span>Total Paid</span><b>{money(sample.total)}</b></p><small>GST, where applicable, is included in the selling price.</small></div>
                  {(settings.show_upi_qr || settings.show_bank) && <div className="payBox">{settings.show_upi_qr && <div className="qr">{upiQrImageUrl ? <img src={upiQrImageUrl} alt="UPI QR" /> : <><b>UPI</b><small>Set ID</small></>}</div>}<div>{settings.show_upi_qr && <><b>Scan & Pay</b><small>{settings.upi_id || "Set your UPI ID"}</small></>}{settings.show_bank && <small>{settings.bank_name || "Bank details"}</small>}</div></div>}
                  {settings.show_terms && settings.terms_text && <div className="terms">{settings.terms_text}</div>}
                  <div className="waPreview"><div className="waTop"><span>WHATSAPP INVOICE</span><b>Ready to share</b></div><div className="waBubble">{whatsappInvoiceText.split("\n").map((line,index)=><p key={`${index}-${line}`}>{line || "\u00A0"}</p>)}</div></div>
                  <footer><b>{settings.footer_message}</b><small>Powered by NCS Billing</small></footer>
                </>
              )}
            </article>
          </div>
          <div className="identityNote"><span>BUSINESS IDENTITY</span><p>Logo, phone, email, store details existing Branding / Store Settings నుంచే వస్తాయి. UPI ID save చేస్తే నిజమైన scan-ready QR automaticగా తయారవుతుంది.</p></div>
        </aside>
      </section>

      {loading && <div className="loading"><i /><span>Opening Invoice Studio...</span></div>}

      <style jsx global>{`
        *{box-sizing:border-box}
        .studioPage{min-height:100vh;padding:28px;background:radial-gradient(circle at 7% 0%,rgba(212,175,55,.16),transparent 24%),radial-gradient(circle at 100% 10%,rgba(10,46,115,.10),transparent 28%),${IVORY};color:#2c2c2c;font-family:Poppins,Inter,Arial,sans-serif}
        .studioHero{min-height:180px;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:30px 34px;border:1px solid rgba(212,175,55,.62);border-radius:28px;background:radial-gradient(circle at 85% 15%,rgba(212,175,55,.28),transparent 25%),linear-gradient(135deg,${DEEP},${BLUE} 64%,#1c5ab4);box-shadow:0 24px 55px rgba(3,21,63,.22),inset 0 1px 0 rgba(255,255,255,.12);color:#fff}
        .studioHero>div:first-child>span{color:#f4d85b;font-size:10px;font-weight:950;letter-spacing:1.2px}
        .studioHero h1{margin:10px 0 0;font-size:clamp(30px,4vw,48px);line-height:1.05}
        .studioHero p{max-width:720px;margin:13px 0 0;color:rgba(255,255,255,.72);font-size:14px}
        .heroActions{display:grid;justify-items:end;gap:12px}
        .heroActions em{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.08);font-size:9px;font-style:normal;font-weight:900}
        .heroActions em i{width:8px;height:8px;border-radius:50%;background:#3ce39b;box-shadow:0 0 0 4px rgba(60,227,155,.12),0 0 13px rgba(60,227,155,.8)}
        .heroActions button{min-height:48px;padding:0 20px;border:0;border-radius:15px;background:linear-gradient(135deg,${GOLD},#f4d85b);color:${DEEP};font-size:13px;font-weight:950;cursor:pointer}
        .modeTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0;padding:8px;border:1px solid rgba(10,46,115,.08);border-radius:19px;background:rgba(255,255,255,.8);box-shadow:0 10px 28px rgba(3,21,63,.08)}
        .modeTabs button{min-height:66px;display:grid;place-items:center;gap:2px;border:1px solid transparent;border-radius:14px;background:transparent;color:#6e7480;cursor:pointer}
        .modeTabs button strong{font-size:12px}.modeTabs button small{font-size:9px}
        .modeTabs button.active{border-color:rgba(212,175,55,.55);background:linear-gradient(135deg,${DEEP},${BLUE});color:#fff}
        .modeTabs button.active small{color:#f3d66f}
        .studioNotice{margin-bottom:16px;padding:12px 16px;border:1px solid rgba(22,131,74,.22);border-radius:13px;background:rgba(22,131,74,.08);color:#126b3e;font-size:11px;font-weight:800}
        .workspace{display:grid;grid-template-columns:minmax(0,.95fr) minmax(440px,1.05fr);gap:20px;align-items:start}
        .controls{display:grid;gap:16px}
        .panel{padding:20px;border:1px solid rgba(10,46,115,.09);border-radius:22px;background:rgba(255,255,255,.92);box-shadow:0 14px 34px rgba(3,21,63,.08)}
        .panelTitle{display:flex;align-items:center;gap:12px}
        .panelTitle>b{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(212,175,55,.56);border-radius:13px;background:rgba(212,175,55,.10);color:#9a7100;font-size:10px}
        .panelTitle h2{margin:0;color:${DEEP};font-size:17px}.panelTitle p{margin:4px 0 0;color:#7c8390;font-size:10px}
        .themeGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:16px}
        .themeGrid button{min-height:146px;padding:12px;border:1px solid rgba(10,46,115,.10);border-radius:16px;background:#fff;text-align:left;cursor:pointer}
        .themeGrid button.active{border-color:rgba(212,175,55,.78);box-shadow:0 12px 25px rgba(10,46,115,.12)}
        .themeGrid button>i{height:66px;display:grid;align-content:center;gap:7px;margin-bottom:10px;padding:10px;border-radius:11px;background:linear-gradient(145deg,${DEEP},${BLUE})}
        .themeGrid button>i span{height:4px;border-radius:99px;background:rgba(255,255,255,.64)}
        .themeGrid button>i span:first-child{width:55%;background:#f3d66f}.themeGrid button>i span:nth-child(2){width:86%}.themeGrid button>i span:nth-child(3){width:70%}
        .themeGrid button strong,.themeGrid button small{display:block}.themeGrid button strong{color:${DEEP};font-size:11px}.themeGrid button small{margin-top:4px;color:#808793;font-size:8px}
        .segment{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:16px}
        .segment button{min-height:60px;display:grid;place-items:center;border:1px solid rgba(10,46,115,.10);border-radius:14px;background:#fff;color:${DEEP};font-weight:900;cursor:pointer}
        .segment button small{font-size:8px;color:#858b95}.segment button.active{border-color:rgba(212,175,55,.68);background:linear-gradient(135deg,rgba(212,175,55,.12),rgba(10,46,115,.04))}
        .copies{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding:13px 14px;border:1px solid rgba(10,46,115,.08);border-radius:14px;background:#fbfcff}
        .copies span strong,.copies span small{display:block}.copies span strong{font-size:11px;color:${DEEP}}.copies span small{font-size:8px;color:#858b95}
        .copies>div{display:flex;align-items:center;gap:10px}.copies button{width:32px;height:32px;border:1px solid rgba(10,46,115,.12);border-radius:10px;background:#fff;color:${BLUE};font-weight:950}
        .studioToggle{width:100%;min-height:65px;display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px;padding:11px 12px;border:1px solid rgba(10,46,115,.08);border-radius:14px;background:#fbfcff;text-align:left;cursor:pointer}
        .studioToggle.on{border-color:rgba(212,175,55,.34);background:linear-gradient(135deg,rgba(212,175,55,.08),#fff)}
        .studioToggle>span strong,.studioToggle>span small{display:block}.studioToggle>span strong{color:${DEEP};font-size:10px}.studioToggle>span small{margin-top:3px;color:#8a909a;font-size:7px}
        .studioToggle>i{width:42px;height:24px;display:flex;align-items:center;padding:3px;border-radius:999px;background:#dfe3ea}.studioToggle>i b{width:18px;height:18px;border-radius:50%;background:#fff;transition:.2s}
        .studioToggle.on>i{background:linear-gradient(135deg,${BLUE},#1c5ab4)}.studioToggle.on>i b{transform:translateX(18px);background:#f4d85b}
        .toggleGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:8px}
        .panel label{display:grid;gap:6px;margin-top:14px}.panel label>span{color:${DEEP};font-size:9px;font-weight:850}
        .panel input,.panel textarea{width:100%;border:1px solid rgba(10,46,115,.12);border-radius:13px;background:#fff;color:#2c2c2c;font:inherit;font-size:11px;outline:none}
        .panel input{min-height:44px;padding:0 12px}.panel textarea{padding:11px 12px}.twoFields{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .previewCard{position:sticky;top:84px;overflow:hidden;border:1px solid rgba(212,175,55,.36);border-radius:24px;background:linear-gradient(180deg,${DEEP},${BLUE});box-shadow:0 22px 52px rgba(3,21,63,.18)}
        .previewCard>header{min-height:76px;display:flex;align-items:center;justify-content:space-between;padding:16px 18px;color:#fff}
        .previewCard>header span,.previewCard>header strong{display:block}.previewCard>header span{color:#f3d66f;font-size:8px;font-weight:950}.previewCard>header strong{margin-top:4px;font-size:13px}
        .previewCard>header button{min-height:36px;padding:0 12px;border:1px solid rgba(255,255,255,.22);border-radius:11px;background:rgba(255,255,255,.08);color:#fff;font-size:9px;font-weight:900}
        .stage{min-height:670px;display:grid;place-items:start center;padding:24px;background:radial-gradient(circle at 50% 4%,rgba(212,175,55,.18),transparent 25%),#e9edf4}
        .invoice{width:min(100%,560px);min-height:610px;padding:24px;border-radius:16px;background:#fff;color:#202733;box-shadow:0 20px 44px rgba(3,21,63,.18)}
        .invoice.theme-signature{border-top:8px solid ${BLUE}}.invoice.theme-minimal{border-top:3px solid #d8dce5}.invoice.theme-counter{border-top:5px solid ${GOLD}}
        .invoice.mode-whatsapp{width:390px;border-radius:26px;border-top-color:#25d366!important;background:linear-gradient(180deg,#fff,#fbfffc)!important}
        .brand{display:flex;align-items:center;justify-content:center;gap:10px;text-align:center}.logo{width:58px;height:58px;display:grid;place-items:center;overflow:hidden;border:1px solid rgba(212,175,55,.62);border-radius:16px}
        .logo img,.a4Mark img,.thermalLogo img,.qr img{width:100%;height:100%;object-fit:contain}.logo span,.a4Mark span,.thermalLogo span{color:${BLUE};font-weight:950}
        .brand h2{margin:0;color:${BLUE};font-size:19px}.brand small{display:block;margin-top:4px;color:#9a7100;font-size:7px;font-weight:850}
        .businessInfo{display:grid;justify-items:center;gap:3px;margin-top:12px;color:#667085;font-size:8px;text-align:center}
        .invoice hr{border:0;height:1px;margin:15px 0;background:linear-gradient(90deg,transparent,rgba(10,46,115,.36),transparent)}
        .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.meta>div{padding:8px;border-radius:9px;background:#f5f7fb}.meta span,.meta b{display:block}.meta span{font-size:6px;color:#838a95}.meta b{margin-top:3px;color:${DEEP};font-size:8px}
        .items{margin-top:15px;border-top:1px solid #dfe3ea;border-bottom:1px solid #dfe3ea}.head,.row{display:grid;grid-template-columns:minmax(0,1fr) 45px 88px;gap:6px;padding:8px 0;align-items:center}
        .head{font-size:6px;font-weight:900;color:#8b919b}.row{border-top:1px dashed #e3e6eb;font-size:8px}
        .head span:nth-child(2),.row span:nth-child(2){text-align:center}.head span:last-child,.row span:last-child{text-align:right}
        .totals{margin-top:12px}.totals p{display:flex;justify-content:space-between;margin:6px 0;font-size:8px}.totals .grand{margin-top:10px;padding:10px;border-radius:10px;background:linear-gradient(135deg,${DEEP},${BLUE});color:#fff;font-size:11px}.totals>small{display:block;margin-top:6px;color:#7b828c;font-size:6px}
        .payBox{display:flex;align-items:center;gap:10px;margin-top:13px;padding:10px;border:1px solid rgba(212,175,55,.28);border-radius:11px;background:rgba(212,175,55,.06)}.payBox b,.payBox small{display:block}.payBox b{color:${DEEP};font-size:9px}.payBox small{margin-top:4px;color:#737b87;font-size:7px}
        .qr{width:68px;height:68px;display:grid;place-items:center;overflow:hidden;padding:4px;border:1px solid rgba(212,175,55,.6);border-radius:12px;background:#fff}
        .terms{margin-top:12px;padding:8px 9px;border-radius:9px;background:#f7f8fa;color:#737b87;font-size:6px}.invoice footer{display:grid;justify-items:center;gap:5px;margin-top:17px;padding-top:12px;border-top:1px dashed #dfe3ea;text-align:center}.invoice footer b{color:${BLUE};font-size:8px}.invoice footer small{color:#9a7100;font-size:6px}
        .waPreview{margin-top:14px;padding:10px;border:1px solid rgba(37,211,102,.28);border-radius:14px;background:linear-gradient(180deg,#eefcf3,#fbfffc)}.waTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.waTop span{color:#168a47;font-size:7px;font-weight:950;letter-spacing:.5px}.waTop b{color:#0a6333;font-size:8px}.waBubble{margin-left:18px;padding:10px;border-radius:13px 13px 3px 13px;background:#dff7e7;box-shadow:0 6px 14px rgba(22,138,71,.08)}.waBubble p{margin:1px 0;color:#1e3a2a;font-size:7px;line-height:1.45}

        /* International A4 preview */
        .invoice.mode-a4{width:min(100%,600px);padding:28px 30px 24px;border-radius:10px}
        .a4Masthead{display:flex;justify-content:space-between;align-items:flex-start;gap:18px}
        .a4Identity{display:flex;gap:14px;min-width:0}.a4Mark{width:52px;height:52px;flex:0 0 52px;display:grid;place-items:center;overflow:hidden;padding:5px;border:4px solid ${BLUE};outline:1px solid ${GOLD};outline-offset:-7px;background:#fff}
        .a4BrandText h2{margin:0;color:${BLUE};font-size:20px;line-height:1}.a4BrandText small{display:block;margin-top:6px;color:${GOLD};font-size:6px;font-weight:950;letter-spacing:.6px}.a4BrandText p{max-width:280px;margin:9px 0 0;color:#6b7280;font-size:6.5px;line-height:1.45}
        .a4Contacts{display:flex;gap:7px;flex-wrap:wrap;margin-top:4px;color:#7a808a;font-size:6px}
        .a4InvoiceType{min-width:130px;text-align:right}.a4InvoiceType b{display:block;color:${BLUE};font-size:11px}.a4InvoiceType small{display:block;margin-top:5px;color:${GOLD};font-size:6px;font-weight:900}
        .a4GoldRule{height:2px;margin:18px 0;background:linear-gradient(90deg,${GOLD} 0 24%,rgba(10,46,115,.12) 24%)}
        .a4MetaGrid{display:grid;grid-template-columns:1.25fr .75fr;gap:12px}.a4CustomerCard{padding:14px;border:1px solid #e3e6ec;background:#fafbfe}.a4CustomerCard span{display:block;color:${GOLD};font-size:6px;font-weight:950}.a4CustomerCard strong{display:block;margin-top:7px;color:${BLUE};font-size:10px}.a4CustomerCard small{display:block;margin-top:5px;color:#747b86;font-size:6px}
        .a4BillCard{padding:12px 14px;background:${BLUE};color:#fff}.a4BillCard p{display:grid;grid-template-columns:55px 1fr;gap:6px;margin:0 0 8px}.a4BillCard p:last-child{margin-bottom:0}.a4BillCard span{color:${GOLD};font-size:5.5px;font-weight:950}.a4BillCard b{font-size:6.5px}
        .premiumItems{margin-top:18px}.premiumItems .head{padding:8px 7px;background:#f5f7fb;color:${BLUE};border-top:1px solid ${GOLD}}.premiumItems .row{padding:10px 7px}
        .a4BottomGrid{display:grid;grid-template-columns:1fr 220px;gap:18px;align-items:start;margin-top:14px}.a4PayBox{margin-top:0}.a4Totals{margin-top:0}.a4Totals .grand{border-top:3px solid ${GOLD};border-radius:0;background:${BLUE};color:#fff}

        /* Real thermal preview proportions */
        .invoice.mode-thermal{min-height:0;width:320px;padding:18px 16px;border-radius:6px}
        .invoice.mode-thermal.thermal-58{width:245px;padding:15px 12px}
        .thermalBrand{text-align:center}.thermalLogo{width:42px;height:42px;display:grid;place-items:center;overflow:hidden;margin:0 auto 8px;padding:4px;border:1px solid ${GOLD};background:#fff}
        .thermalBrand h2{margin:0;color:${BLUE};font-size:15px;line-height:1}.invoice.thermal-58 .thermalBrand h2{font-size:13px}
        .thermalBrand small{display:block;margin-top:5px;color:${GOLD};font-size:5.5px;font-weight:950;letter-spacing:.5px}.thermalBrand i{display:block;width:72%;height:1px;margin:9px auto;background:${GOLD}}
        .thermalBrand p{margin:3px 0;color:#737983;font-size:5.4px;line-height:1.35}.thermalDivider{margin:10px 0;border-top:1px dashed #bcc1c9}
        .thermalMeta{display:grid;gap:5px}.thermalMeta p{display:grid;grid-template-columns:50px 1fr;gap:6px;margin:0;font-size:6px}.thermalMeta span{color:#7f858e}.thermalMeta b{color:#202733}
        .thermalItems{margin-top:11px}.thermalItems .head{padding:6px 4px;background:#f5f7fb;color:${BLUE}}.thermalItems .row{padding:8px 4px;font-size:6.4px}.invoice.thermal-58 .thermalItems .row{font-size:5.8px}
        .thermalTotals{margin-top:10px}.thermalTotals p{display:flex;justify-content:space-between;margin:5px 0;font-size:6.4px}.thermalTotals .grand{margin-top:8px;padding:9px;background:${BLUE};color:#fff;border-top:3px solid ${GOLD};font-size:8px;font-weight:950}.thermalTotals>small{display:block;margin-top:6px;color:#6e7480;font-size:5.5px}
        .thermalPay{display:grid;justify-items:center;gap:5px;margin-top:12px;padding-top:11px;border-top:1px dashed #c9cdd4;text-align:center}.thermalPay .qr{width:62px;height:62px}.invoice.thermal-58 .thermalPay .qr{width:54px;height:54px}.thermalPay b{color:${BLUE};font-size:6px}.thermalPay small{display:block;color:#737983;font-size:5px}
        .thermalStatus{margin-top:11px;text-align:center;color:${BLUE};font-size:5.4px;font-weight:950;letter-spacing:.4px}

        .identityNote{padding:16px 18px 18px;color:rgba(255,255,255,.72)}.identityNote span{color:#f3d66f;font-size:8px;font-weight:950}.identityNote p{margin:7px 0 0;font-size:9px}
        .loading{position:fixed;z-index:200;inset:0;display:grid;place-items:center;align-content:center;gap:13px;background:rgba(3,21,63,.84);color:#fff;backdrop-filter:blur(12px)}.loading i{width:40px;height:40px;border:4px solid rgba(255,255,255,.2);border-top-color:${GOLD};border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media(max-width:1180px){.workspace{grid-template-columns:1fr}.previewCard{position:relative;top:auto}}
        @media(max-width:760px){.studioPage{padding:14px}.studioHero{min-height:0;align-items:flex-start;flex-direction:column;padding:22px}.heroActions{width:100%;grid-template-columns:1fr 1fr;justify-items:stretch}.modeTabs,.themeGrid,.toggleGrid,.twoFields{grid-template-columns:1fr}.stage{min-height:0;padding:14px 6px}.a4MetaGrid,.a4BottomGrid{grid-template-columns:1fr}.a4Masthead{flex-direction:column}.a4InvoiceType{text-align:left}}
        @media print{
          body *{visibility:hidden!important}
          .invoice,.invoice *{visibility:visible!important}
          .invoice{position:absolute;left:0;top:0;min-height:0;box-shadow:none;border-radius:0}
          .invoice.mode-a4{width:210mm!important;min-height:297mm;padding:14mm!important}
          .invoice.mode-thermal.thermal-80{width:80mm!important;padding:4mm!important}
          .invoice.mode-thermal.thermal-58{width:58mm!important;padding:3mm!important}
          .previewCard,.stage{overflow:visible!important;background:#fff!important}
        }
      `}</style>
    </main>
  );
}