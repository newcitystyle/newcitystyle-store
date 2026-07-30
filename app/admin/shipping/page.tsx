"use client";

import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type ShippingSettings = {
  id: number;
  free_shipping: boolean;
  free_shipping_min: number;
  flat_rate: number;
  cod_charge: number;
  estimated_days: string | null;
  provider_name?: string | null;
  api_base_url?: string | null;
  tracking_url_template?: string | null;
  pickup_pincode?: string | null;
  pickup_location_name?: string | null;
  pickup_address?: string | null;
  default_weight_kg?: number | null;
  package_length_cm?: number | null;
  package_width_cm?: number | null;
  package_height_cm?: number | null;
  cod_enabled?: boolean | null;
  prepaid_enabled?: boolean | null;
  integration_enabled?: boolean | null;
  auto_create_shipment?: boolean | null;
  auto_generate_label?: boolean | null;
  auto_schedule_pickup?: boolean | null;
  api_key_configured?: boolean | null;
  created_at: string;
};

type ShippingForm = {
  freeShipping: boolean;
  freeShippingMin: string;
  flatRate: string;
  codCharge: string;
  estimatedDays: string;
  providerName: string;
  apiBaseUrl: string;
  trackingUrlTemplate: string;
  pickupPincode: string;
  pickupLocationName: string;
  pickupAddress: string;
  defaultWeightKg: string;
  packageLengthCm: string;
  packageWidthCm: string;
  packageHeightCm: string;
  codEnabled: boolean;
  prepaidEnabled: boolean;
  integrationEnabled: boolean;
  autoCreateShipment: boolean;
  autoGenerateLabel: boolean;
  autoSchedulePickup: boolean;
  apiKeyConfigured: boolean;
};

const defaultForm: ShippingForm = {
  freeShipping: true,
  freeShippingMin: "999",
  flatRate: "79",
  codCharge: "0",
  estimatedDays: "3-7 business days",
  providerName: "",
  apiBaseUrl: "",
  trackingUrlTemplate: "",
  pickupPincode: "",
  pickupLocationName: "NEW CITY STYLE",
  pickupAddress: "",
  defaultWeightKg: "0.5",
  packageLengthCm: "25",
  packageWidthCm: "20",
  packageHeightCm: "5",
  codEnabled: true,
  prepaidEnabled: true,
  integrationEnabled: false,
  autoCreateShipment: false,
  autoGenerateLabel: false,
  autoSchedulePickup: false,
  apiKeyConfigured: false,
};

export default function ShippingSettingsPage() {
  const [settingsId, setSettingsId] =
    useState<number | null>(null);

  const [form, setForm] =
    useState<ShippingForm>(defaultForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] =
    useState<string | null>(null);

  useEffect(() => {
    loadShippingSettings();
  }, []);

  async function loadShippingSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("shipping_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error(error);

      alert(
        `Unable to load shipping settings: ${error.message}`
      );

      setLoading(false);
      return;
    }

    if (!data) {
      const { data: newSettings, error: insertError } =
        await supabase
          .from("shipping_settings")
          .insert({
            free_shipping: true,
            free_shipping_min: 999,
            flat_rate: 79,
            cod_charge: 0,
            estimated_days: "3-7 business days",
          })
          .select()
          .single();

      if (insertError) {
        console.error(insertError);

        alert(
          `Unable to create shipping settings: ${insertError.message}`
        );

        setLoading(false);
        return;
      }

      applySettings(
        newSettings as ShippingSettings
      );

      setLoading(false);
      return;
    }

    applySettings(data as ShippingSettings);
    setLoading(false);
  }

  function applySettings(
    settings: ShippingSettings
  ) {
    setSettingsId(settings.id);

    setForm({
      freeShipping: Boolean(
        settings.free_shipping
      ),
      freeShippingMin: String(
        settings.free_shipping_min ?? 0
      ),
      flatRate: String(
        settings.flat_rate ?? 0
      ),
      codCharge: String(
        settings.cod_charge ?? 0
      ),
      estimatedDays:
        settings.estimated_days ||
        "3-7 business days",
      providerName: settings.provider_name || "",
      apiBaseUrl: settings.api_base_url || "",
      trackingUrlTemplate:
        settings.tracking_url_template || "",
      pickupPincode: settings.pickup_pincode || "",
      pickupLocationName:
        settings.pickup_location_name || "NEW CITY STYLE",
      pickupAddress: settings.pickup_address || "",
      defaultWeightKg: String(
        settings.default_weight_kg ?? 0.5
      ),
      packageLengthCm: String(
        settings.package_length_cm ?? 25
      ),
      packageWidthCm: String(
        settings.package_width_cm ?? 20
      ),
      packageHeightCm: String(
        settings.package_height_cm ?? 5
      ),
      codEnabled: settings.cod_enabled ?? true,
      prepaidEnabled: settings.prepaid_enabled ?? true,
      integrationEnabled:
        settings.integration_enabled ?? false,
      autoCreateShipment:
        settings.auto_create_shipment ?? false,
      autoGenerateLabel:
        settings.auto_generate_label ?? false,
      autoSchedulePickup:
        settings.auto_schedule_pickup ?? false,
      apiKeyConfigured:
        settings.api_key_configured ?? false,
    });

    setLastSaved(
      settings.created_at || null
    );
  }

  function validateForm() {
    const freeShippingMin = Number(
      form.freeShippingMin
    );

    const flatRate = Number(
      form.flatRate
    );

    const codCharge = Number(
      form.codCharge
    );

    if (
      Number.isNaN(freeShippingMin) ||
      freeShippingMin < 0
    ) {
      alert(
        "Please enter a valid free shipping minimum amount."
      );

      return false;
    }

    if (
      Number.isNaN(flatRate) ||
      flatRate < 0
    ) {
      alert(
        "Please enter a valid flat shipping rate."
      );

      return false;
    }

    if (
      Number.isNaN(codCharge) ||
      codCharge < 0
    ) {
      alert(
        "Please enter a valid Cash on Delivery charge."
      );

      return false;
    }

    if (!form.estimatedDays.trim()) {
      alert(
        "Please enter an estimated delivery time."
      );

      return false;
    }

    if (form.integrationEnabled && !form.providerName.trim()) {
      alert("Please enter the delivery company name.");
      return false;
    }

    if (form.apiBaseUrl.trim()) {
      try {
        new URL(form.apiBaseUrl.trim());
      } catch {
        alert("Please enter a valid Delivery API base URL.");
        return false;
      }
    }

    if (
      form.pickupPincode.trim() &&
      !/^\d{6}$/.test(form.pickupPincode.trim())
    ) {
      alert("Pickup pincode must contain exactly 6 digits.");
      return false;
    }

    const packageValues = [
      form.defaultWeightKg,
      form.packageLengthCm,
      form.packageWidthCm,
      form.packageHeightCm,
    ].map(Number);

    if (packageValues.some((value) => !Number.isFinite(value) || value < 0)) {
      alert("Please enter valid package weight and dimensions.");
      return false;
    }

    return true;
  }

  async function saveShippingSettings(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!validateForm()) return;

    setSaving(true);

    const settingsData = {
      free_shipping:
        form.freeShipping,
      free_shipping_min: Number(
        form.freeShippingMin || 0
      ),
      flat_rate: Number(
        form.flatRate || 0
      ),
      cod_charge: Number(
        form.codCharge || 0
      ),
      estimated_days:
        form.estimatedDays.trim(),
      provider_name: form.providerName.trim(),
      api_base_url: form.apiBaseUrl.trim(),
      tracking_url_template:
        form.trackingUrlTemplate.trim(),
      pickup_pincode: form.pickupPincode.trim(),
      pickup_location_name:
        form.pickupLocationName.trim(),
      pickup_address: form.pickupAddress.trim(),
      default_weight_kg: Number(form.defaultWeightKg || 0),
      package_length_cm: Number(form.packageLengthCm || 0),
      package_width_cm: Number(form.packageWidthCm || 0),
      package_height_cm: Number(form.packageHeightCm || 0),
      cod_enabled: form.codEnabled,
      prepaid_enabled: form.prepaidEnabled,
      integration_enabled: form.integrationEnabled,
      auto_create_shipment: form.autoCreateShipment,
      auto_generate_label: form.autoGenerateLabel,
      auto_schedule_pickup: form.autoSchedulePickup,
      api_key_configured: form.apiKeyConfigured,
    };

    if (settingsId === null) {
      const { data, error } =
        await supabase
          .from("shipping_settings")
          .insert(settingsData)
          .select()
          .single();

      if (error) {
        console.error(error);

        alert(
          `Unable to save shipping settings: ${error.message}`
        );

        setSaving(false);
        return;
      }

      applySettings(
        data as ShippingSettings
      );

      alert(
        "Shipping settings saved successfully."
      );

      setSaving(false);
      return;
    }

    const { data, error } =
      await supabase
        .from("shipping_settings")
        .update(settingsData)
        .eq("id", settingsId)
        .select()
        .single();

    if (error) {
      console.error(error);

      alert(
        `Unable to update shipping settings: ${error.message}`
      );

      setSaving(false);
      return;
    }

    applySettings(
      data as ShippingSettings
    );

    alert(
      "Shipping settings updated successfully."
    );

    setSaving(false);
  }

  function resetForm() {
    const confirmed =
      window.confirm(
        "Reset the shipping form to recommended default values?"
      );

    if (!confirmed) return;

    setForm(defaultForm);
  }

  function updateTextField(
    field: keyof ShippingForm,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    const value = event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateBooleanField(
    field: keyof ShippingForm,
    value: boolean
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function calculateShipping(
    orderAmount: number,
    paymentMethod: "COD" | "Online"
  ) {
    let shippingCharge =
      Number(form.flatRate || 0);

    if (
      form.freeShipping &&
      orderAmount >=
        Number(
          form.freeShippingMin || 0
        )
    ) {
      shippingCharge = 0;
    }

    const codCharge =
      paymentMethod === "COD"
        ? Number(
            form.codCharge || 0
          )
        : 0;

    return {
      shippingCharge,
      codCharge,
      totalCharge:
        shippingCharge + codCharge,
    };
  }

  const exampleOrderAmount = 799;

  const exampleCod =
    calculateShipping(
      exampleOrderAmount,
      "COD"
    );

  const exampleOnline =
    calculateShipping(
      exampleOrderAmount,
      "Online"
    );

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
        <div
          style={{
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "58px",
              height: "58px",
              margin:
                "0 auto 18px",
              borderRadius: "50%",
              border:
                "6px solid #E5E7EB",
              borderTopColor:
                "#0A2E73",
              animation:
                "shipping-spin 0.8s linear infinite",
            }}
          />

          <h2
            style={{
              color: "#0A2E73",
              margin: 0,
            }}
          >
            Loading Shipping Settings...
          </h2>
        </div>

        <style jsx global>{`
          @keyframes shipping-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#F8F4EC",
        padding:
          "30px 20px 80px",
      }}
    >
      <div
        className="shipping-page-shell"
        style={{
          maxWidth: "1400px",
          margin: "0 auto",
        }}
      >
        <section
          className="shipping-hero premium-shine"
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
              letterSpacing:
                "1.4px",
              margin:
                "0 0 8px",
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
            Shipping Settings
          </h1>

          <p
            style={{
              margin:
                "11px 0 0",
              opacity: 0.9,
              lineHeight: 1.6,
            }}
          >
            Configure shipping charges, free delivery,
            Cash on Delivery fees and delivery time.
          </p>

          {lastSaved && (
            <p
              style={{
                margin:
                  "9px 0 0",
                color:
                  "rgba(255,255,255,0.68)",
                fontSize: "13px",
              }}
            >
              Settings loaded successfully.
            </p>
          )}
        </section>

        <section
          className="shipping-summary-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "16px",
            marginBottom: "25px",
          }}
        >
          <SummaryCard
            icon="🚚"
            title="Standard Shipping"
            value={`₹${Number(
              form.flatRate || 0
            ).toLocaleString(
              "en-IN"
            )}`}
          />

          <SummaryCard
            icon="🎁"
            title="Free Shipping"
            value={
              form.freeShipping
                ? "Enabled"
                : "Disabled"
            }
            positive={
              form.freeShipping
            }
          />

          <SummaryCard
            icon="🛍️"
            title="Free Shipping Above"
            value={`₹${Number(
              form.freeShippingMin ||
                0
            ).toLocaleString(
              "en-IN"
            )}`}
          />

          <SummaryCard
            icon="💵"
            title="COD Charge"
            value={`₹${Number(
              form.codCharge || 0
            ).toLocaleString(
              "en-IN"
            )}`}
          />

          <SummaryCard
            icon="⏱️"
            title="Delivery Time"
            value={
              form.estimatedDays
            }
          />
        </section>

        <div
          className="shipping-layout"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(0, 1.1fr) 430px",
            gap: "24px",
            alignItems: "start",
          }}
        >
          <form
            className="shipping-form-stack"
            onSubmit={
              saveShippingSettings
            }
            style={{
              display: "grid",
              gap: "22px",
            }}
          >
            <SettingsPanel
              title="Standard Shipping"
              subtitle="Configure the regular shipping charge applied to customer orders."
            >
              <FormField label="Flat Shipping Rate">
                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <span
                    style={{
                      position:
                        "absolute",
                      left: "14px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color:
                        "#0A2E73",
                      fontWeight: 800,
                    }}
                  >
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      form.flatRate
                    }
                    placeholder="79"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          flatRate:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    style={{
                      ...inputStyle,
                      paddingLeft:
                        "33px",
                    }}
                  />
                </div>
              </FormField>

              <div
                style={
                  informationBoxStyle
                }
              >
                <div
                  style={{
                    fontSize:
                      "24px",
                  }}
                >
                  📦
                </div>

                <div>
                  <strong
                    style={{
                      color:
                        "#0A2E73",
                    }}
                  >
                    Standard delivery charge
                  </strong>

                  <p
                    style={{
                      color: "#555",
                      margin:
                        "5px 0 0",
                      lineHeight:
                        1.6,
                      fontSize:
                        "14px",
                    }}
                  >
                    This amount will be charged when the order does
                    not qualify for free shipping.
                  </p>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Free Shipping"
              subtitle="Offer free delivery when the order reaches a minimum value."
            >
              <ShippingToggle
                icon="🎁"
                title="Enable Free Shipping"
                description="Orders above the minimum amount will receive free delivery."
                enabled={
                  form.freeShipping
                }
                onChange={(
                  enabled
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      freeShipping:
                        enabled,
                    })
                  )
                }
              />

              <FormField label="Minimum Order for Free Shipping">
                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <span
                    style={{
                      position:
                        "absolute",
                      left: "14px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color:
                        "#0A2E73",
                      fontWeight: 800,
                    }}
                  >
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    disabled={
                      !form.freeShipping
                    }
                    value={
                      form.freeShippingMin
                    }
                    placeholder="999"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          freeShippingMin:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    style={{
                      ...inputStyle,
                      paddingLeft:
                        "33px",
                      opacity:
                        form.freeShipping
                          ? 1
                          : 0.55,
                      cursor:
                        form.freeShipping
                          ? "text"
                          : "not-allowed",
                    }}
                  />
                </div>
              </FormField>
            </SettingsPanel>

            <SettingsPanel
              title="Cash on Delivery Charge"
              subtitle="Add an optional extra charge for Cash on Delivery orders."
            >
              <FormField label="COD Charge">
                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <span
                    style={{
                      position:
                        "absolute",
                      left: "14px",
                      top: "50%",
                      transform:
                        "translateY(-50%)",
                      color:
                        "#0A2E73",
                      fontWeight: 800,
                    }}
                  >
                    ₹
                  </span>

                  <input
                    type="number"
                    min="0"
                    value={
                      form.codCharge
                    }
                    placeholder="0"
                    onChange={(
                      event
                    ) =>
                      setForm(
                        (
                          current
                        ) => ({
                          ...current,
                          codCharge:
                            event
                              .target
                              .value,
                        })
                      )
                    }
                    style={{
                      ...inputStyle,
                      paddingLeft:
                        "33px",
                    }}
                  />
                </div>
              </FormField>

              <div
                style={
                  informationBoxStyle
                }
              >
                <div
                  style={{
                    fontSize:
                      "24px",
                  }}
                >
                  💵
                </div>

                <div>
                  <strong
                    style={{
                      color:
                        "#0A2E73",
                    }}
                  >
                    Optional COD fee
                  </strong>

                  <p
                    style={{
                      color: "#555",
                      margin:
                        "5px 0 0",
                      lineHeight:
                        1.6,
                      fontSize:
                        "14px",
                    }}
                  >
                    Enter 0 when Cash on Delivery should not have
                    an additional charge.
                  </p>
                </div>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Delivery Estimate"
              subtitle="Tell customers how long their order may take to arrive."
            >
              <FormField label="Estimated Delivery Time">
                <input
                  value={
                    form.estimatedDays
                  }
                  placeholder="Example: 3-7 business days"
                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        current
                      ) => ({
                        ...current,
                        estimatedDays:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </FormField>

              <div
                style={{
                  display:
                    "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "10px",
                }}
              >
                {[
                  "2-4 business days",
                  "3-7 business days",
                  "5-10 business days",
                ].map(
                  (
                    option
                  ) => (
                    <button
                      key={
                        option
                      }
                      type="button"
                      onClick={() =>
                        setForm(
                          (
                            current
                          ) => ({
                            ...current,
                            estimatedDays:
                              option,
                          })
                        )
                      }
                      style={{
                        background:
                          form.estimatedDays ===
                          option
                            ? "#0A2E73"
                            : "#FFFFFF",
                        color:
                          form.estimatedDays ===
                          option
                            ? "#FFFFFF"
                            : "#0A2E73",
                        border:
                          "1px solid #D1D5DB",
                        borderRadius:
                          "9px",
                        padding:
                          "11px",
                        cursor:
                          "pointer",
                        fontWeight:
                          700,
                      }}
                    >
                      {
                        option
                      }
                    </button>
                  )
                )}
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Delivery Partner API"
              subtitle="Configure your courier provider, tracking URL and integration readiness."
            >
              <div style={informationBoxStyle}>
                <span style={{ fontSize: "22px" }}>🔐</span>
                <div>
                  <strong style={{ color: "#0A2E73" }}>
                    Keep the secret API key in environment variables
                  </strong>
                  <p style={{ margin: "5px 0 0", color: "#555", fontSize: "13px", lineHeight: 1.6 }}>
                    Do not save the courier secret key in this page. Add it to
                    .env.local and your hosting Environment Variables.
                  </p>
                </div>
              </div>

              <div className="delivery-api-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px", marginTop: "18px" }}>
                <FormField label="Delivery Company Name">
                  <input
                    value={form.providerName}
                    onChange={(event) => updateTextField("providerName", event)}
                    placeholder="Example: Delhivery, Shiprocket"
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="API Base URL">
                  <input
                    type="url"
                    value={form.apiBaseUrl}
                    onChange={(event) => updateTextField("apiBaseUrl", event)}
                    placeholder="https://api.deliverycompany.com"
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="Tracking URL Template">
                <input
                  value={form.trackingUrlTemplate}
                  onChange={(event) => updateTextField("trackingUrlTemplate", event)}
                  placeholder="https://track.company.com/{tracking_number}"
                  style={inputStyle}
                />
                <small style={{ display: "block", marginTop: "7px", color: "#777" }}>
                  Use {"{tracking_number}"} where the courier tracking number should appear.
                </small>
              </FormField>

              <ShippingToggle
                icon="🔗"
                title="Enable Delivery Integration"
                description="Activates courier API features after the provider is configured."
                enabled={form.integrationEnabled}
                onChange={(value) => updateBooleanField("integrationEnabled", value)}
              />

              <ShippingToggle
                icon="🔑"
                title="API Key Configured"
                description="Enable only after the secret API key is added to environment variables."
                enabled={form.apiKeyConfigured}
                onChange={(value) => updateBooleanField("apiKeyConfigured", value)}
              />
            </SettingsPanel>

            <SettingsPanel
              title="Store Pickup Details"
              subtitle="Pickup location used when creating courier shipments."
            >
              <div className="delivery-api-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "16px" }}>
                <FormField label="Pickup Location Name">
                  <input
                    value={form.pickupLocationName}
                    onChange={(event) => updateTextField("pickupLocationName", event)}
                    placeholder="NEW CITY STYLE"
                    style={inputStyle}
                  />
                </FormField>

                <FormField label="Pickup Pincode">
                  <input
                    inputMode="numeric"
                    maxLength={6}
                    value={form.pickupPincode}
                    onChange={(event) => updateTextField("pickupPincode", event)}
                    placeholder="Enter 6-digit pincode"
                    style={inputStyle}
                  />
                </FormField>
              </div>

              <FormField label="Complete Pickup Address">
                <textarea
                  value={form.pickupAddress}
                  onChange={(event) => updateTextField("pickupAddress", event)}
                  placeholder="Enter complete store pickup address"
                  style={{ ...inputStyle, minHeight: "110px", resize: "vertical" }}
                />
              </FormField>
            </SettingsPanel>

            <SettingsPanel
              title="Default Package"
              subtitle="Default weight and dimensions sent to the courier when product-level values are unavailable."
            >
              <div className="delivery-package-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "14px" }}>
                <FormField label="Weight (kg)">
                  <input type="number" min="0" step="0.01" value={form.defaultWeightKg} onChange={(event) => updateTextField("defaultWeightKg", event)} style={inputStyle} />
                </FormField>
                <FormField label="Length (cm)">
                  <input type="number" min="0" step="0.1" value={form.packageLengthCm} onChange={(event) => updateTextField("packageLengthCm", event)} style={inputStyle} />
                </FormField>
                <FormField label="Width (cm)">
                  <input type="number" min="0" step="0.1" value={form.packageWidthCm} onChange={(event) => updateTextField("packageWidthCm", event)} style={inputStyle} />
                </FormField>
                <FormField label="Height (cm)">
                  <input type="number" min="0" step="0.1" value={form.packageHeightCm} onChange={(event) => updateTextField("packageHeightCm", event)} style={inputStyle} />
                </FormField>
              </div>
            </SettingsPanel>

            <SettingsPanel
              title="Delivery Order Eligibility"
              subtitle="Choose which payment methods can be sent to the delivery partner."
            >
              <ShippingToggle icon="💵" title="Cash on Delivery Orders" description="Allow COD orders to be sent to the courier provider." enabled={form.codEnabled} onChange={(value) => updateBooleanField("codEnabled", value)} />
              <ShippingToggle icon="💳" title="Prepaid Orders" description="Allow Razorpay and other paid orders to be sent to the courier provider." enabled={form.prepaidEnabled} onChange={(value) => updateBooleanField("prepaidEnabled", value)} />
            </SettingsPanel>

            <SettingsPanel
              title="Shipment Automation"
              subtitle="Prepare automatic courier actions after an order is confirmed."
            >
              <ShippingToggle icon="📦" title="Automatic Shipment Creation" description="Create a courier shipment automatically after order confirmation." enabled={form.autoCreateShipment} onChange={(value) => updateBooleanField("autoCreateShipment", value)} />
              <ShippingToggle icon="🏷️" title="Automatic Shipping Label" description="Generate a shipping label after shipment creation." enabled={form.autoGenerateLabel} onChange={(value) => updateBooleanField("autoGenerateLabel", value)} />
              <ShippingToggle icon="🚚" title="Automatic Pickup Request" description="Request courier pickup automatically when supported by the provider." enabled={form.autoSchedulePickup} onChange={(value) => updateBooleanField("autoSchedulePickup", value)} />
            </SettingsPanel>

            <section
              style={{
                background:
                  "#FFFFFF",
                borderRadius:
                  "18px",
                padding: "22px",
                boxShadow:
                  "0 8px 25px rgba(0,0,0,0.07)",
                border:
                  "1px solid rgba(212,175,55,0.22)",
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: "13px",
                flexWrap:
                  "wrap",
              }}
            >
              <button
                className="shipping-secondary-button"
                type="button"
                onClick={
                  resetForm
                }
                style={{
                  background:
                    "#FFFFFF",
                  color:
                    "#6B7280",
                  border:
                    "1px solid #D1D5DB",
                  padding:
                    "13px 20px",
                  borderRadius:
                    "10px",
                  cursor:
                    "pointer",
                  fontWeight:
                    800,
                }}
              >
                Reset Form
              </button>

              <button
                className="shipping-primary-button"
                type="submit"
                disabled={
                  saving
                }
                style={{
                  background:
                    "linear-gradient(135deg, #03153F, #0A2E73)",
                  color:
                    "#FFFFFF",
                  border:
                    "1px solid rgba(212,175,55,0.85)",
                  padding:
                    "14px 25px",
                  borderRadius:
                    "10px",
                  cursor:
                    saving
                      ? "not-allowed"
                      : "pointer",
                  fontSize:
                    "16px",
                  fontWeight:
                    800,
                  opacity:
                    saving
                      ? 0.7
                      : 1,
                }}
              >
                {saving
                  ? "Saving Settings..."
                  : "Save Shipping Settings"}
              </button>
            </section>
          </form>

          <aside
            className="shipping-preview-stack"
            style={{
              position:
                "sticky",
              top: "95px",
              display:
                "grid",
              gap: "20px",
            }}
          >
            <section
              style={
                previewPanelStyle
              }
            >
              <div
                style={{
                  background:
                    "linear-gradient(135deg, #071A43, #0A2E73)",
                  borderRadius:
                    "15px",
                  padding:
                    "22px",
                  color:
                    "#FFFFFF",
                  marginBottom:
                    "18px",
                }}
              >
                <p
                  style={{
                    color:
                      "#D4AF37",
                    margin:
                      "0 0 7px",
                    fontWeight:
                      800,
                    letterSpacing:
                      "1px",
                  }}
                >
                  NEW CITY STYLE
                </p>

                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Shipping Preview
                </h2>

                <p
                  style={{
                    margin:
                      "7px 0 0",
                    opacity:
                      0.8,
                    fontSize:
                      "14px",
                  }}
                >
                  Checkout delivery information
                </p>
              </div>

              <PreviewRow
                icon="🚚"
                label="Standard Shipping"
                value={`₹${Number(
                  form.flatRate ||
                    0
                ).toLocaleString(
                  "en-IN"
                )}`}
              />

              <PreviewRow
                icon="🎁"
                label="Free Shipping"
                value={
                  form.freeShipping
                    ? `Above ₹${Number(
                        form.freeShippingMin ||
                          0
                      ).toLocaleString(
                        "en-IN"
                      )}`
                    : "Disabled"
                }
              />

              <PreviewRow
                icon="💵"
                label="COD Charge"
                value={`₹${Number(
                  form.codCharge ||
                    0
                ).toLocaleString(
                  "en-IN"
                )}`}
              />

              <PreviewRow
                icon="⏱️"
                label="Delivery Time"
                value={
                  form.estimatedDays ||
                  "Not configured"
                }
              />
            </section>

            <section
              style={
                previewPanelStyle
              }
            >
              <h3
                style={{
                  color:
                    "#0A2E73",
                  margin:
                    "0 0 15px",
                }}
              >
                Example Checkout
              </h3>

              <p
                style={{
                  color:
                    "#777",
                  margin:
                    "0 0 14px",
                  fontSize:
                    "13px",
                }}
              >
                Example order amount: ₹
                {exampleOrderAmount}
              </p>

              <ChargePreview
                title="Online Payment"
                shipping={
                  exampleOnline.shippingCharge
                }
                codCharge={
                  exampleOnline.codCharge
                }
                total={
                  exampleOnline.totalCharge
                }
              />

              <ChargePreview
                title="Cash on Delivery"
                shipping={
                  exampleCod.shippingCharge
                }
                codCharge={
                  exampleCod.codCharge
                }
                total={
                  exampleCod.totalCharge
                }
              />
            </section>

            <section
              style={
                previewPanelStyle
              }
            >
              <h3
                style={{
                  color:
                    "#0A2E73",
                  margin:
                    "0 0 15px",
                }}
              >
                Configuration Status
              </h3>

              <ConfigurationRow
                label="Flat Shipping Rate"
                configured={
                  Number(
                    form.flatRate ||
                      0
                  ) >= 0
                }
              />

              <ConfigurationRow
                label="Free Shipping"
                configured={
                  form.freeShipping
                }
              />

              <ConfigurationRow
                label="COD Charge"
                configured={
                  Number(
                    form.codCharge ||
                      0
                  ) >= 0
                }
              />

              <ConfigurationRow
                label="Delivery Estimate"
                configured={Boolean(
                  form.estimatedDays.trim()
                )}
              />

              <ConfigurationRow
                label="Delivery Partner"
                configured={Boolean(form.providerName.trim())}
              />

              <ConfigurationRow
                label="API Integration"
                configured={form.integrationEnabled && form.apiKeyConfigured}
              />

              <ConfigurationRow
                label="Pickup Location"
                configured={Boolean(form.pickupLocationName.trim() && form.pickupPincode.trim())}
              />
            </section>
          </aside>
        </div>
      </div>

      <style jsx global>{`
        @keyframes shipping-fade-up {
          from {
            opacity: 0;
            transform: translate3d(0, 24px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        @keyframes shipping-float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-7px);
          }
        }

        @keyframes shipping-shimmer {
          0% {
            transform: translateX(-130%) skewX(-18deg);
          }
          55%, 100% {
            transform: translateX(230%) skewX(-18deg);
          }
        }

        @keyframes shipping-pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.25);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(22, 163, 74, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
          }
        }

        .shipping-page-shell {
          animation: shipping-fade-up 0.65s ease both;
        }

        .shipping-hero {
          position: relative;
          overflow: hidden;
          isolation: isolate;
          animation: shipping-fade-up 0.7s ease both;
        }

        .shipping-hero::after {
          content: "";
          position: absolute;
          inset: -45% auto -45% -35%;
          width: 32%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.18),
            transparent
          );
          transform: translateX(-130%) skewX(-18deg);
          animation: shipping-shimmer 5.5s ease-in-out infinite;
          pointer-events: none;
          z-index: -1;
        }


        .shipping-premium-summary-card {
          position: relative;
          isolation: isolate;
          min-height: 140px;
          overflow: hidden;
          padding: 20px;
          border: 1px solid rgba(212, 175, 55, 0.22);
          border-radius: 18px;
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(3, 21, 63, 0.98)
          );
          box-shadow:
            0 12px 28px rgba(3, 21, 63, 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.06);
          transition:
            transform 0.22s ease,
            box-shadow 0.22s ease,
            border-color 0.22s ease;
        }

        .shipping-premium-summary-card:nth-child(2),
        .shipping-premium-summary-card:nth-child(5) {
          background: linear-gradient(
            135deg,
            rgba(10, 46, 115, 0.99),
            rgba(22, 46, 102, 0.98),
            rgba(103, 79, 16, 0.9)
          );
        }

        .shipping-premium-summary-card:nth-child(3) {
          background: linear-gradient(
            135deg,
            rgba(5, 25, 74, 0.99),
            rgba(8, 37, 96, 0.98)
          );
        }

        .shipping-premium-summary-card:nth-child(4) {
          background: linear-gradient(
            135deg,
            rgba(18, 35, 82, 0.99),
            rgba(119, 75, 12, 0.92)
          );
        }

        .shipping-premium-summary-card::before {
          content: "";
          position: absolute;
          z-index: -1;
          top: -40%;
          right: -15%;
          width: 125px;
          height: 125px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(212, 175, 55, 0.34),
            rgba(212, 175, 55, 0)
          );
        }

        .shipping-premium-summary-card::after {
          content: "";
          position: absolute;
          top: -145%;
          left: -36%;
          width: 42%;
          height: 370%;
          transform: rotate(22deg);
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255, 255, 255, 0.14),
            transparent
          );
          animation: shippingPremiumStatShine 5.2s ease-in-out infinite;
          pointer-events: none;
        }

        .shipping-premium-summary-card:hover {
          transform: translateY(-3px) scale(1.004);
          border-color: rgba(212, 175, 55, 0.42);
          box-shadow:
            0 16px 32px rgba(3, 21, 63, 0.22),
            0 0 0 1px rgba(212, 175, 55, 0.1);
        }

        .shipping-premium-summary-icon {
          position: relative;
          z-index: 2;
          color: #D4AF37;
          font-size: 30px;
          filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.18));
        }

        .shipping-premium-summary-card p {
          position: relative;
          z-index: 2;
          margin: 10px 0 5px;
          color: rgba(212, 175, 55, 0.94);
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.45px;
          text-transform: uppercase;
        }

        .shipping-premium-summary-card h2 {
          position: relative;
          z-index: 2;
          margin: 0;
          color: #FFFFFF;
          font-size: 24px;
          font-weight: 950;
          letter-spacing: -0.4px;
          overflow-wrap: anywhere;
          text-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        }

        .shipping-premium-summary-card h2.is-positive,
        .shipping-premium-summary-card:nth-child(5) h2 {
          color: #F6D676;
        }

        @keyframes shippingPremiumStatShine {
          0%, 62% {
            left: -42%;
            opacity: 0;
          }
          68% {
            opacity: 0.7;
          }
          100% {
            left: 126%;
            opacity: 0;
          }
        }

        .shipping-summary-grid > * {
          opacity: 0;
          animation: shipping-fade-up 0.55s ease forwards;
        }

        .shipping-summary-grid > *:nth-child(1) { animation-delay: .08s; }
        .shipping-summary-grid > *:nth-child(2) { animation-delay: .14s; }
        .shipping-summary-grid > *:nth-child(3) { animation-delay: .20s; }
        .shipping-summary-grid > *:nth-child(4) { animation-delay: .26s; }
        .shipping-summary-grid > *:nth-child(5) { animation-delay: .32s; }

        .shipping-summary-card,
        .shipping-settings-panel,
        .shipping-preview-stack > section {
          transition:
            transform .28s ease,
            box-shadow .28s ease,
            border-color .28s ease;
        }

        .shipping-summary-card:hover {
          transform: translateY(-7px);
          box-shadow: 0 18px 38px rgba(10,46,115,.14) !important;
          border-color: rgba(212,175,55,.55) !important;
        }

        .shipping-summary-card > div:first-child {
          display: inline-block;
          animation: shipping-float 3.2s ease-in-out infinite;
        }

        .shipping-settings-panel {
          animation: shipping-fade-up .6s ease both;
        }

        .shipping-settings-panel:hover,
        .shipping-preview-stack > section:hover {
          transform: translateY(-3px);
          box-shadow: 0 18px 42px rgba(10,46,115,.11) !important;
          border-color: rgba(212,175,55,.48) !important;
        }

        .shipping-toggle-card {
          transition:
            transform .24s ease,
            background .24s ease,
            border-color .24s ease;
        }

        .shipping-toggle-card:hover {
          transform: translateX(4px);
        }

        .shipping-toggle-card.is-enabled button {
          animation: shipping-pulse-ring 2.5s ease-out infinite;
        }

        .shipping-primary-button,
        .shipping-secondary-button {
          transition:
            transform .2s ease,
            box-shadow .2s ease,
            filter .2s ease;
        }

        .shipping-primary-button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px rgba(10,46,115,.28);
          filter: brightness(1.06);
        }

        .shipping-secondary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 9px 20px rgba(0,0,0,.09);
        }

        .shipping-primary-button:active:not(:disabled),
        .shipping-secondary-button:active {
          transform: translateY(0) scale(.98);
        }

        input,
        textarea,
        button {
          transition:
            border-color .2s ease,
            box-shadow .2s ease,
            transform .2s ease,
            background-color .2s ease;
        }

        input:focus,
        textarea:focus {
          border-color: #0A2E73 !important;
          box-shadow: 0 0 0 4px rgba(10,46,115,.10);
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *::before,
          *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 1050px) {
          .shipping-layout {
            grid-template-columns: 1fr !important;
          }

          .shipping-layout aside {
            position: static !important;
          }

          .delivery-package-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 650px) {
          .delivery-api-grid,
          .delivery-package-grid {
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

const informationBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "13px",
  background: "#EFF6FF",
  border: "1px solid #BFDBFE",
  borderRadius: "11px",
  padding: "15px",
};

const previewPanelStyle: CSSProperties = {
  background: "#FFFFFF",
  borderRadius: "19px",
  padding: "22px",
  boxShadow: "0 8px 25px rgba(0,0,0,0.07)",
  border: "1px solid rgba(212,175,55,0.22)",
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
      className="shipping-settings-panel"
      style={{
        background: "#FFFFFF",
        borderRadius: "18px",
        padding: "24px",
        boxShadow:
          "0 8px 25px rgba(0,0,0,0.07)",
        border:
          "1px solid rgba(212,175,55,0.22)",
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

function ShippingToggle({
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
      className={`shipping-toggle-card ${enabled ? "is-enabled" : ""}`}
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: "18px",
        padding: "18px",
        borderRadius: "13px",
        border: enabled
          ? "1px solid #86EFAC"
          : "1px solid #E5E7EB",
        background: enabled
          ? "#F0FDF4"
          : "#FFFFFF",
        marginBottom: "17px",
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
            background: enabled
              ? "#DCFCE7"
              : "#F3F4F6",
            display: "flex",
            justifyContent:
              "center",
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
        onClick={() =>
          onChange(!enabled)
        }
        style={{
          position: "relative",
          width: "55px",
          height: "30px",
          flexShrink: 0,
          borderRadius:
            "999px",
          border: "none",
          background: enabled
            ? "#16A34A"
            : "#D1D5DB",
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
            borderRadius:
              "50%",
            background:
              "#FFFFFF",
            top: "3px",
            left: enabled
              ? "28px"
              : "3px",
            boxShadow:
              "0 2px 7px rgba(0,0,0,0.2)",
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
    <div className="shipping-premium-summary-card">
      <div className="shipping-premium-summary-icon">{icon}</div>
      <p>{title}</p>
      <h2 className={positive ? "is-positive" : ""}>{value}</h2>
    </div>
  );
}

function PreviewRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: "15px",
        padding: "14px 0",
        borderBottom:
          "1px solid #E5E7EB",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          color: "#555",
          fontWeight: 700,
        }}
      >
        <span>{icon}</span>
        <span>{label}</span>
      </div>

      <strong
        style={{
          color: "#0A2E73",
          textAlign: "right",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function ChargePreview({
  title,
  shipping,
  codCharge,
  total,
}: {
  title: string;
  shipping: number;
  codCharge: number;
  total: number;
}) {
  return (
    <div
      style={{
        border:
          "1px solid #E5E7EB",
        borderRadius: "12px",
        padding: "15px",
        marginBottom: "12px",
      }}
    >
      <h4
        style={{
          color: "#0A2E73",
          margin: "0 0 12px",
        }}
      >
        {title}
      </h4>

      <PreviewChargeRow
        label="Shipping"
        value={`₹${shipping}`}
      />

      <PreviewChargeRow
        label="COD Charge"
        value={`₹${codCharge}`}
      />

      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          borderTop:
            "1px solid #E5E7EB",
          marginTop: "9px",
          paddingTop: "11px",
        }}
      >
        <strong
          style={{
            color: "#555",
          }}
        >
          Total Charge
        </strong>

        <strong
          style={{
            color: "#D4AF37",
            fontSize: "19px",
          }}
        >
          ₹{total}
        </strong>
      </div>
    </div>
  );
}

function PreviewChargeRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent:
          "space-between",
        marginBottom: "7px",
        color: "#666",
        fontSize: "13px",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
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
        justifyContent:
          "space-between",
        alignItems: "center",
        gap: "12px",
        padding: "12px 0",
        borderBottom:
          "1px solid #E5E7EB",
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
          background: configured
            ? "#DCFCE7"
            : "#FEE2E2",
          color: configured
            ? "#166534"
            : "#B91C1C",
          padding: "6px 9px",
          borderRadius:
            "999px",
          fontSize: "12px",
          fontWeight: 800,
        }}
      >
        {configured
          ? "Configured"
          : "Not Configured"}
      </span>
    </div>
  );
}