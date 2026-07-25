"use client";

import {
  type CSSProperties,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type PaymentSettings = {
  id: number;
  razorpay_enabled: boolean;
  cod_enabled: boolean;
  razorpay_key_id: string | null;
  upi_id: string | null;
  qr_image: string | null;
  currency: string;
  payment_instructions: string | null;
  created_at: string;
  updated_at: string;
};

type PaymentForm = {
  razorpayEnabled: boolean;
  codEnabled: boolean;
  razorpayKeyId: string;
  upiId: string;
  qrImage: string;
  currency: string;
  paymentInstructions: string;
};

const defaultForm: PaymentForm = {
  razorpayEnabled: false,
  codEnabled: true,
  razorpayKeyId: "",
  upiId: "",
  qrImage: "",
  currency: "INR",
  paymentInstructions:
    "Complete your payment securely. For payment assistance, contact NEW CITY STYLE customer support.",
};

export default function PaymentSettingsPage() {
  const [settingsId, setSettingsId] = useState<number | null>(null);
  const [form, setForm] = useState<PaymentForm>(defaultForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingImage, setTestingImage] = useState(false);
  const [imageValid, setImageValid] = useState<boolean | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  useEffect(() => {
    loadPaymentSettings();
  }, []);

  async function loadPaymentSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("payment_settings")
      .select(
        `
          id,
          razorpay_enabled,
          cod_enabled,
          razorpay_key_id,
          upi_id,
          qr_image,
          currency,
          payment_instructions,
          created_at,
          updated_at
        `
      )
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);
      alert(`Unable to load payment settings: ${error.message}`);
      setLoading(false);
      return;
    }

    if (!data) {
      const { data: newSettings, error: insertError } =
        await supabase
          .from("payment_settings")
          .insert({
            razorpay_enabled: false,
            cod_enabled: true,
            currency: "INR",
            payment_instructions:
              defaultForm.paymentInstructions,
          })
          .select(
            `
              id,
              razorpay_enabled,
              cod_enabled,
              razorpay_key_id,
              upi_id,
              qr_image,
              currency,
              payment_instructions,
              created_at,
              updated_at
            `
          )
          .single();

      if (insertError) {
        console.error(insertError);
        alert(
          `Unable to create payment settings: ${insertError.message}`
        );
        setLoading(false);
        return;
      }

      applySettings(newSettings as PaymentSettings);
      setLoading(false);
      return;
    }

    applySettings(data as PaymentSettings);
    setLoading(false);
  }

  function applySettings(settings: PaymentSettings) {
    setSettingsId(settings.id);

    setForm({
      razorpayEnabled: Boolean(settings.razorpay_enabled),
      codEnabled: Boolean(settings.cod_enabled),
      razorpayKeyId: settings.razorpay_key_id || "",
      upiId: settings.upi_id || "",
      qrImage: settings.qr_image || "",
      currency: settings.currency || "INR",
      paymentInstructions:
        settings.payment_instructions ||
        defaultForm.paymentInstructions,
    });

    setLastSaved(settings.updated_at || null);
    setImageValid(null);
  }

  function validateForm() {
    if (!form.codEnabled && !form.razorpayEnabled) {
      alert(
        "Please enable at least one payment method: Cash on Delivery or Online Payment."
      );
      return false;
    }

    if (
      form.razorpayEnabled &&
      !form.razorpayKeyId.trim()
    ) {
      alert(
        "Please enter the Razorpay Key ID before enabling online payments."
      );
      return false;
    }

    if (
      form.upiId.trim() &&
      !/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(
        form.upiId.trim()
      )
    ) {
      alert("Please enter a valid UPI ID.");
      return false;
    }

    if (
      form.qrImage.trim() &&
      !/^https?:\/\/.+/i.test(form.qrImage.trim())
    ) {
      alert("QR image must be a valid HTTP or HTTPS URL.");
      return false;
    }

    if (!form.currency.trim()) {
      alert("Please select a currency.");
      return false;
    }

    return true;
  }

  async function savePaymentSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const settingsData = {
      razorpay_enabled: form.razorpayEnabled,
      cod_enabled: form.codEnabled,
      razorpay_key_id:
        form.razorpayKeyId.trim() || null,
      upi_id: form.upiId.trim() || null,
      qr_image: form.qrImage.trim() || null,
      currency: form.currency.trim(),
      payment_instructions:
        form.paymentInstructions.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (settingsId === null) {
      const { data, error } = await supabase
        .from("payment_settings")
        .insert(settingsData)
        .select(
          `
            id,
            razorpay_enabled,
            cod_enabled,
            razorpay_key_id,
            upi_id,
            qr_image,
            currency,
            payment_instructions,
            created_at,
            updated_at
          `
        )
        .single();

      if (error) {
        console.error(error);
        alert(
          `Unable to save payment settings: ${error.message}`
        );
        setSaving(false);
        return;
      }

      applySettings(data as PaymentSettings);
      alert("Payment settings saved successfully.");
      setSaving(false);
      return;
    }

    const { data, error } = await supabase
      .from("payment_settings")
      .update(settingsData)
      .eq("id", settingsId)
      .select(
        `
          id,
          razorpay_enabled,
          cod_enabled,
          razorpay_key_id,
          upi_id,
          qr_image,
          currency,
          payment_instructions,
          created_at,
          updated_at
        `
      )
      .single();

    if (error) {
      console.error(error);
      alert(
        `Unable to update payment settings: ${error.message}`
      );
      setSaving(false);
      return;
    }

    applySettings(data as PaymentSettings);
    alert("Payment settings updated successfully.");
    setSaving(false);
  }

  function resetPaymentSettings() {
    const confirmed = window.confirm(
      "Reset the payment form to the recommended default settings?"
    );

    if (!confirmed) return;

    setForm(defaultForm);
    setImageValid(null);
  }

  function testQrImage() {
    const url = form.qrImage.trim();

    if (!url) {
      alert("Please enter a QR image URL.");
      return;
    }

    if (!/^https?:\/\/.+/i.test(url)) {
      alert("Please enter a valid QR image URL.");
      return;
    }

    setTestingImage(true);
    setImageValid(null);

    const image = new Image();

    image.onload = () => {
      setTestingImage(false);
      setImageValid(true);
      alert("QR image loaded successfully.");
    };

    image.onerror = () => {
      setTestingImage(false);
      setImageValid(false);
      alert("Unable to load the QR image.");
    };

    image.src = url;
  }

  if (loading) {
    return (
      <main
        style={{
          minHeight: "100vh",
          background: "#F8F4EC",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "30px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "58px",
              height: "58px",
              margin: "0 auto 18px",
              borderRadius: "50%",
              border: "6px solid #E5E7EB",
              borderTopColor: "#0A2E73",
              animation: "payment-spin 0.8s linear infinite",
            }}
          />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Payment Settings...
          </h2>
        </div>

        <style jsx global>{`
          @keyframes payment-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  const enabledMethods =
    Number(form.codEnabled) +
    Number(form.razorpayEnabled);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8F4EC",
        padding: "30px 20px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <section
          style={{
            background:
              "linear-gradient(135deg, #071A43 0%, #0A2E73 55%, #164CA8 100%)",
            borderRadius: "24px",
            padding: "32px",
            color: "#FFFFFF",
            marginBottom: "25px",
            boxShadow:
              "0 15px 40px rgba(10,46,115,0.25)",
          }}
        >
          <p
            style={{
              color: "#D4AF37",
              fontWeight: 800,
              letterSpacing: "1.4px",
              margin: "0 0 8px",
            }}
          >
            NEW CITY STYLE
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "38px",
            }}
          >
            Payment Settings
          </h1>

          <p
            style={{
              margin: "11px 0 0",
              opacity: 0.9,
              lineHeight: 1.6,
            }}
          >
            Configure Cash on Delivery, Razorpay, UPI and payment
            instructions.
          </p>

          {lastSaved && (
            <p
              style={{
                margin: "9px 0 0",
                color: "rgba(255,255,255,0.68)",
                fontSize: "13px",
              }}
            >
              Last saved:{" "}
              {new Date(lastSaved).toLocaleString("en-IN")}
            </p>
          )}
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <SummaryCard
            icon="💳"
            title="Enabled Methods"
            value={enabledMethods}
          />

          <SummaryCard
            icon="💵"
            title="Cash on Delivery"
            value={form.codEnabled ? "Enabled" : "Disabled"}
            positive={form.codEnabled}
          />

          <SummaryCard
            icon="⚡"
            title="Online Payment"
            value={
              form.razorpayEnabled
                ? "Enabled"
                : "Disabled"
            }
            positive={form.razorpayEnabled}
          />

          <SummaryCard
            icon="₹"
            title="Store Currency"
            value={form.currency}
            positive
          />
        </section>

        <div
          className="payment-settings-layout"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.15fr) 430px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <form
            onSubmit={savePaymentSettings}
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <SettingsPanel
              title="Payment Methods"
              subtitle="Choose the payment options available at checkout."
            >
              <PaymentToggle
                icon="💵"
                title="Cash on Delivery"
                description="Customers can pay when their order is delivered."
                enabled={form.codEnabled}
                onChange={(enabled) =>
                  setForm((current) => ({
                    ...current,
                    codEnabled: enabled,
                  }))
                }
              />

              <PaymentToggle
                icon="💳"
                title="Razorpay Online Payment"
                description="Accept UPI, debit cards, credit cards and net banking."
                enabled={form.razorpayEnabled}
                onChange={(enabled) =>
                  setForm((current) => ({
                    ...current,
                    razorpayEnabled: enabled,
                  }))
                }
              />
            </SettingsPanel>

            <SettingsPanel
              title="Razorpay Configuration"
              subtitle="Add your public Razorpay Key ID."
            >
              <FormField label="Razorpay Key ID">
                <input
                  value={form.razorpayKeyId}
                  placeholder="Example: rzp_live_xxxxxxxxxx"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      razorpayKeyId: event.target.value.trim(),
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <div style={securityNoticeStyle}>
                <div style={{ fontSize: "25px" }}>🔐</div>

                <div>
                  <strong
                    style={{
                      color: "#0A2E73",
                    }}
                  >
                    Secure Razorpay Secret
                  </strong>

                  <p
                    style={{
                      color: "#555",
                      margin: "5px 0 0",
                      lineHeight: 1.6,
                      fontSize: "14px",
                    }}
                  >
                    The Razorpay Key Secret must not be stored in this
                    browser form. It will be added securely to
                    <strong> .env.local</strong> when Razorpay checkout
                    integration is completed.
                  </p>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="UPI and QR Payment"
              subtitle="Configure direct UPI payment information."
            >
              <FormField label="UPI ID">
                <input
                  value={form.upiId}
                  placeholder="Example: newcitystyle@upi"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      upiId: event.target.value,
                    }))
                  }
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Payment QR Image URL">
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: "10px",
                  }}
                >
                  <input
                    value={form.qrImage}
                    placeholder="https://example.com/payment-qr.jpg"
                    onChange={(event) => {
                      setForm((current) => ({
                        ...current,
                        qrImage: event.target.value,
                      }));

                      setImageValid(null);
                    }}
                    style={inputStyle}
                  />

                  <button
                    type="button"
                    onClick={testQrImage}
                    disabled={testingImage}
                    style={{
                      border: "none",
                      background: "#D4AF37",
                      color: "#FFFFFF",
                      borderRadius: "9px",
                      padding: "0 17px",
                      fontWeight: 800,
                      cursor: testingImage
                        ? "not-allowed"
                        : "pointer",
                      opacity: testingImage ? 0.7 : 1,
                    }}
                  >
                    {testingImage ? "Testing..." : "Test"}
                  </button>
                </div>
              </FormField>

              {imageValid === true && (
                <div
                  style={{
                    background: "#F0FDF4",
                    color: "#166534",
                    border: "1px solid #BBF7D0",
                    padding: "11px 13px",
                    borderRadius: "9px",
                    fontWeight: 700,
                    marginBottom: "16px",
                  }}
                >
                  QR image URL is working.
                </div>
              )}

              {imageValid === false && (
                <div
                  style={{
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    border: "1px solid #FECACA",
                    padding: "11px 13px",
                    borderRadius: "9px",
                    fontWeight: 700,
                    marginBottom: "16px",
                  }}
                >
                  QR image could not be loaded.
                </div>
              )}
            </SettingsPanel>

            <SettingsPanel
              title="Currency and Instructions"
              subtitle="Configure checkout currency and customer guidance."
            >
              <FormField label="Currency">
                <select
                  value={form.currency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                  style={inputStyle}
                >
                  <option value="INR">
                    INR — Indian Rupee
                  </option>
                </select>
              </FormField>

              <FormField label="Payment Instructions">
                <textarea
                  value={form.paymentInstructions}
                  placeholder="Enter payment instructions for customers..."
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      paymentInstructions:
                        event.target.value,
                    }))
                  }
                  style={{
                    ...inputStyle,
                    minHeight: "130px",
                    resize: "vertical",
                    lineHeight: 1.6,
                  }}
                />
              </FormField>
            </SettingsPanel>

            <section
              style={{
                background: "#FFFFFF",
                borderRadius: "18px",
                padding: "22px",
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.07)",
                border:
                  "1px solid rgba(212,175,55,0.22)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "13px",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={resetPaymentSettings}
                style={{
                  background: "#FFFFFF",
                  color: "#6B7280",
                  border: "1px solid #D1D5DB",
                  padding: "13px 20px",
                  borderRadius: "10px",
                  cursor: "pointer",
                  fontWeight: 800,
                }}
              >
                Reset Form
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  background: "#0A2E73",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "14px 25px",
                  borderRadius: "10px",
                  cursor: saving
                    ? "not-allowed"
                    : "pointer",
                  fontSize: "16px",
                  fontWeight: 800,
                  opacity: saving ? 0.7 : 1,
                }}
              >
                {saving
                  ? "Saving Settings..."
                  : "Save Payment Settings"}
              </button>
            </section>
          </form>

          <aside
            style={{
              position: "sticky",
              top: "95px",
              display: "grid",
              gap: "20px",
            }}
          >
            <section style={previewPanelStyle}>
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #071A43, #0A2E73)",
                  borderRadius: "15px",
                  padding: "22px",
                  color: "#FFFFFF",
                  marginBottom: "18px",
                }}
              >
                <p
                  style={{
                    color: "#D4AF37",
                    margin: "0 0 7px",
                    fontWeight: 800,
                    letterSpacing: "1px",
                  }}
                >
                  NEW CITY STYLE
                </p>

                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Checkout Preview
                </h2>

                <p
                  style={{
                    margin: "7px 0 0",
                    opacity: 0.8,
                    fontSize: "14px",
                  }}
                >
                  Available payment options
                </p>
              </div>

              {form.codEnabled && (
                <PreviewMethod
                  icon="💵"
                  title="Cash on Delivery"
                  description="Pay when your order arrives."
                />
              )}

              {form.razorpayEnabled && (
                <PreviewMethod
                  icon="💳"
                  title="Online Payment"
                  description="UPI, cards and net banking."
                />
              )}

              {!form.codEnabled &&
                !form.razorpayEnabled && (
                  <div
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      color: "#B91C1C",
                      borderRadius: "11px",
                      padding: "18px",
                      fontWeight: 700,
                      textAlign: "center",
                    }}
                  >
                    No payment method is enabled.
                  </div>
                )}

              {form.upiId.trim() && (
                <div
                  style={{
                    background: "#F8F4EC",
                    borderRadius: "11px",
                    padding: "15px",
                    marginTop: "13px",
                  }}
                >
                  <p
                    style={{
                      color: "#777",
                      fontSize: "12px",
                      margin: "0 0 4px",
                    }}
                  >
                    Store UPI ID
                  </p>

                  <strong
                    style={{
                      color: "#0A2E73",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {form.upiId}
                  </strong>
                </div>
              )}

              {form.qrImage.trim() && (
                <div
                  style={{
                    marginTop: "16px",
                    textAlign: "center",
                  }}
                >
                  <img
                    src={form.qrImage}
                    alt="Payment QR preview"
                    onError={(event) => {
                      event.currentTarget.style.display =
                        "none";
                    }}
                    style={{
                      width: "190px",
                      maxWidth: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "contain",
                      borderRadius: "12px",
                      border: "1px solid #E5E7EB",
                      background: "#FFFFFF",
                      padding: "10px",
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  background: "#F8FAFC",
                  borderRadius: "11px",
                  padding: "15px",
                  marginTop: "16px",
                }}
              >
                <p
                  style={{
                    color: "#555",
                    fontSize: "13px",
                    lineHeight: 1.7,
                    margin: 0,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {form.paymentInstructions ||
                    "No payment instructions added."}
                </p>
              </div>
            </section>

            <section style={previewPanelStyle}>
              <h3
                style={{
                  color: "#0A2E73",
                  margin: "0 0 15px",
                }}
              >
                Configuration Status
              </h3>

              <ConfigurationRow
                label="Cash on Delivery"
                configured={form.codEnabled}
              />

              <ConfigurationRow
                label="Razorpay"
                configured={
                  form.razorpayEnabled &&
                  Boolean(form.razorpayKeyId.trim())
                }
              />

              <ConfigurationRow
                label="UPI ID"
                configured={Boolean(form.upiId.trim())}
              />

              <ConfigurationRow
                label="QR Image"
                configured={Boolean(form.qrImage.trim())}
              />

              <ConfigurationRow
                label="Instructions"
                configured={Boolean(
                  form.paymentInstructions.trim()
                )}
              />
            </section>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 1050px) {
          .payment-settings-layout {
            grid-template-columns: 1fr !important;
          }

          .payment-settings-layout aside {
            position: static !important;
          }
        }

        @media (max-width: 560px) {
          .payment-settings-layout {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #D1D5DB",
  borderRadius: "9px",
  background: "#FFFFFF",
  color: "#111827",
  fontSize: "15px",
  outline: "none",
};

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "22px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
};

const securityNoticeStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "13px",
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  borderRadius: "11px",
  padding: "15px",
};

function SettingsPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        borderRadius: "18px",
        padding: "24px",
        boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
        border: "1px solid rgba(212,175,55,0.22)",
      }}
    >
      <div
        style={{
          marginBottom: "21px",
        }}
      >
        <h2
          style={{
            color: "#0A2E73",
            margin: "0 0 5px",
            fontSize: "22px",
          }}
        >
          {title}
        </h2>

        <p
          style={{
            color: "#777",
            fontSize: "13px",
            margin: 0,
          }}
        >
          {subtitle}
        </p>
      </div>

      {children}
    </section>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: "17px",
      }}
    >
      <label
        style={{
          display: "block",
          color: "#0A2E73",
          fontWeight: 700,
          marginBottom: "7px",
        }}
      >
        {label}
      </label>

      {children}
    </div>
  );
}

function PaymentToggle({
  icon,
  title,
  description,
  enabled,
  onChange,
}: {
  icon: string;
  title: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "18px",
        padding: "18px",
        borderRadius: "13px",
        border: enabled
          ? "1px solid #86EFAC"
          : "1px solid #E5E7EB",
        background: enabled ? "#F0FDF4" : "#FFFFFF",
        marginBottom: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "13px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: enabled ? "#DCFCE7" : "#F3F4F6",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "24px",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>

        <div>
          <h3
            style={{
              color: "#0A2E73",
              margin: "0 0 5px",
              fontSize: "17px",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              color: "#777",
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.5,
            }}
          >
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onChange(!enabled)}
        aria-label={`${enabled ? "Disable" : "Enable"} ${title}`}
        style={{
          position: "relative",
          width: "55px",
          height: "30px",
          flexShrink: 0,
          borderRadius: "999px",
          border: "none",
          background: enabled ? "#16A34A" : "#D1D5DB",
          cursor: "pointer",
          padding: 0,
          transition: "0.25s",
        }}
      >
        <span
          style={{
            position: "absolute",
            width: "24px",
            height: "24px",
            borderRadius: "50%",
            background: "#FFFFFF",
            top: "3px",
            left: enabled ? "28px" : "3px",
            boxShadow: "0 2px 7px rgba(0,0,0,0.2)",
            transition: "0.25s",
          }}
        />
      </button>
    </div>
  );
}

function SummaryCard({
  icon,
  title,
  value,
  positive = false,
}: {
  icon: string;
  title: string;
  value: string | number;
  positive?: boolean;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: "16px",
        padding: "20px",
        boxShadow: "0 7px 22px rgba(0,0,0,0.07)",
        border: "1px solid rgba(212,175,55,0.22)",
      }}
    >
      <div style={{ fontSize: "29px" }}>{icon}</div>

      <p
        style={{
          color: "#666",
          margin: "9px 0 5px",
        }}
      >
        {title}
      </p>

      <h2
        style={{
          color: positive ? "#16A34A" : "#0A2E73",
          margin: 0,
          fontSize: "25px",
        }}
      >
        {value}
      </h2>
    </div>
  );
}

function PreviewMethod({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        border: "1px solid #D1D5DB",
        borderRadius: "11px",
        padding: "15px",
        marginBottom: "11px",
      }}
    >
      <div
        style={{
          width: "43px",
          height: "43px",
          borderRadius: "10px",
          background: "#EEF2FF",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>

      <div>
        <strong
          style={{
            color: "#0A2E73",
          }}
        >
          {title}
        </strong>

        <p
          style={{
            color: "#777",
            fontSize: "12px",
            margin: "4px 0 0",
          }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

function ConfigurationRow({
  label,
  configured,
}: {
  label: string;
  configured: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom: "1px solid #E5E7EB",
      }}
    >
      <span
        style={{
          color: "#555",
          fontWeight: 700,
        }}
      >
        {label}
      </span>

      <span
        style={{
          background: configured ? "#DCFCE7" : "#FEE2E2",
          color: configured ? "#166534" : "#B91C1C",
          padding: "6px 9px",
          borderRadius: "999px",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {configured ? "Configured" : "Not Configured"}
      </span>
    </div>
  );
}