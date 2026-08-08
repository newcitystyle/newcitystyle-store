"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type ProductSuggestion = {
  id: string | number;
  name: string;
  price: number;
  mrp: number;
  stock: number;
  onlineStock: number;
  brand: string;
  category: string;
  sizes: string[];
  colors: string[];
  image: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  products?: ProductSuggestion[];
};

type ApiResponse = {
  success?: boolean;
  answer?: string;
  products?: ProductSuggestion[];
  mode?: "ai" | "smart-fallback";
  error?: string;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text:
    "👋 Welcome to NCS Shopping Assistant. Ask about products, price, size, colour, brand or stock — in your preferred Indian language or English.",
};

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function NcsAiAssistant() {
  const pathname = usePathname();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const hidden = useMemo(
    () =>
      pathname?.startsWith("/admin") ||
      pathname?.startsWith("/api"),
    [pathname],
  );

  useEffect(() => {
    if (!open) return;
    window.requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
  }, [messages, open, sending]);

  if (hidden) return null;

  async function sendQuestion(event?: FormEvent) {
    event?.preventDefault();

    const question = input.trim();
    if (!question || sending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: question,
    };

    try {
      window.localStorage.setItem("ncs_ai_last_query", question);
      window.localStorage.setItem(
        "ncs_ai_last_query_at",
        new Date().toISOString(),
      );
    } catch {
      // Storage is optional; chat must continue even when blocked.
    }

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/ai-shopping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question,
          path: pathname || "/",
        }),
      });

      const result = (await response.json()) as ApiResponse;

      if (!response.ok || result.success !== true) {
        throw new Error(result.error || "Unable to answer right now.");
      }

      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text:
            result.answer ||
            "ఈ ప్రశ్నకు సరైన product information దొరకలేదు.",
          products: result.products || [],
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          text:
            error instanceof Error
              ? `క్షమించండి, ఇప్పుడే answer ఇవ్వలేకపోతున్నాను. ${error.message}`
              : "క్షమించండి, ఇప్పుడే answer ఇవ్వలేకపోతున్నాను.",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function askQuick(question: string) {
    if (sending) return;
    setInput(question);
    window.requestAnimationFrame(() => {
      const form = document.getElementById("ncs-ai-form") as HTMLFormElement | null;
      form?.requestSubmit();
    });
  }

  return (
    <>
      <button
        type="button"
        className={`ncsAiLauncher ${open ? "ncsAiLauncherOpen" : ""}`}
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close NCS Shopping Assistant" : "Open NCS Shopping Assistant"}
      >
        <span className="ncsAiSpark">✦</span>
        <span className="ncsAiLauncherText">
          <b>Ask NCS</b>
          <small>AI Shopping Help</small>
        </span>
      </button>

      {open && (
        <section className="ncsAiPanel" aria-label="NCS Shopping Assistant">
          <header className="ncsAiHeader">
            <div className="ncsAiLogo">NCS</div>
            <div>
              <strong>NEW CITY STYLE AI</strong>
              <span>Shopping Assistant • India Multilingual</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close">
              ×
            </button>
          </header>

          <div className="ncsAiMessages" ref={scrollRef}>
            {messages.map((message) => (
              <article
                key={message.id}
                className={`ncsAiMessage ${
                  message.role === "user" ? "ncsAiUser" : "ncsAiAssistant"
                }`}
              >
                <p>{message.text}</p>

                {message.products && message.products.length > 0 && (
                  <div className="ncsAiProducts">
                    {message.products.slice(0, 4).map((product) => (
                      <button
                        type="button"
                        className="ncsAiProduct"
                        key={String(product.id)}
                        onClick={() => {
                          try {
                            const raw =
                              window.localStorage.getItem(
                                "ncs_ai_recent_product_ids",
                              ) || "[]";
                            const parsed = JSON.parse(raw);
                            const current = Array.isArray(parsed)
                              ? parsed.map(String)
                              : [];
                            const next = [
                              String(product.id),
                              ...current.filter(
                                (id) => id !== String(product.id),
                              ),
                            ].slice(0, 12);

                            window.localStorage.setItem(
                              "ncs_ai_recent_product_ids",
                              JSON.stringify(next),
                            );
                          } catch {
                            // Optional personalization only.
                          }

                          setOpen(false);
                          router.push(`/product/${product.id}`);
                        }}
                      >
                        <div className="ncsAiProductImage">
                          {product.image ? (
                            <img src={product.image} alt={product.name} />
                          ) : (
                            <span>NCS</span>
                          )}
                        </div>

                        <div className="ncsAiProductInfo">
                          <strong>{product.name}</strong>
                          <span>
                            {money(product.price)}
                            {product.mrp > product.price && (
                              <del>{money(product.mrp)}</del>
                            )}
                          </span>
                          <small>
                            {product.onlineStock > 0
                              ? `${product.onlineStock} available online`
                              : "Out of stock"}
                          </small>
                          {(product.sizes.length > 0 || product.colors.length > 0) && (
                            <em>
                              {product.sizes.length > 0
                                ? `Sizes: ${product.sizes.slice(0, 5).join(", ")}`
                                : ""}
                              {product.sizes.length > 0 && product.colors.length > 0
                                ? " • "
                                : ""}
                              {product.colors.length > 0
                                ? `Colours: ${product.colors.slice(0, 4).join(", ")}`
                                : ""}
                            </em>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ))}

            {sending && (
              <div className="ncsAiTyping">
                <span />
                <span />
                <span />
              </div>
            )}
          </div>

          <form id="ncs-ai-form" className="ncsAiForm" onSubmit={sendQuestion}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask in Telugu, Hindi, Tamil, Kannada, English..."
              rows={1}
              maxLength={500}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send">
              ➤
            </button>
          </form>

          <footer>
            Answers use the live online catalogue • Stock can change
          </footer>
        </section>
      )}

      <style jsx>{`
        .ncsAiLauncher {
          position: fixed;
          z-index: 2147482000;
          right: 18px;
          bottom: 18px;
          min-height: 58px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 16px 8px 9px;
          border: 1px solid rgba(212, 175, 55, 0.75);
          border-radius: 999px;
          background: linear-gradient(135deg, #03153f, #0a2e73 62%, #164ba8);
          color: #ffffff;
          cursor: pointer;
          box-shadow:
            0 18px 42px rgba(3, 21, 63, 0.28),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;
        }

        .ncsAiLauncherOpen {
          transform: translateY(2px);
        }

        .ncsAiSpark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          flex: 0 0 42px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d4af37, #f6df8a);
          color: #0a2e73;
          font-size: 23px;
          font-weight: 950;
        }

        .ncsAiLauncherText {
          display: grid;
          gap: 1px;
          text-align: left;
        }

        .ncsAiLauncherText b {
          font-size: 13px;
          letter-spacing: 0.2px;
        }

        .ncsAiLauncherText small {
          color: rgba(255, 255, 255, 0.72);
          font-size: 9px;
          font-weight: 700;
        }

        .ncsAiPanel {
          position: fixed;
          z-index: 2147481999;
          right: 18px;
          bottom: 88px;
          width: min(410px, calc(100vw - 24px));
          height: min(650px, calc(100dvh - 115px));
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto auto;
          overflow: hidden;
          border: 1px solid rgba(212, 175, 55, 0.48);
          border-radius: 24px;
          background: #ffffff;
          box-shadow: 0 28px 80px rgba(3, 21, 63, 0.3);
        }

        .ncsAiHeader {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          gap: 10px;
          padding: 14px;
          background:
            radial-gradient(circle at 85% 0%, rgba(212, 175, 55, 0.28), transparent 34%),
            linear-gradient(135deg, #03153f, #0a2e73);
          color: #ffffff;
        }

        .ncsAiLogo {
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(212, 175, 55, 0.75);
          border-radius: 13px;
          background: rgba(212, 175, 55, 0.1);
          color: #d4af37;
          font-size: 12px;
          font-weight: 950;
        }

        .ncsAiHeader strong,
        .ncsAiHeader span {
          display: block;
        }

        .ncsAiHeader strong {
          color: #f1d36b;
          font-size: 12px;
          font-weight: 950;
          letter-spacing: 0.5px;
        }

        .ncsAiHeader span {
          margin-top: 3px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 9px;
          font-weight: 700;
        }

        .ncsAiHeader > button {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
          font-size: 24px;
          cursor: pointer;
        }

        .ncsAiMessages {
          overflow-y: auto;
          padding: 14px 12px 18px;
          background:
            radial-gradient(circle at 100% 0%, rgba(212, 175, 55, 0.07), transparent 24%),
            #f7f9fc;
        }

        .ncsAiMessage {
          max-width: 88%;
          margin-bottom: 11px;
        }

        .ncsAiMessage p {
          margin: 0;
          white-space: pre-wrap;
          font-size: 11px;
          line-height: 1.6;
        }

        .ncsAiAssistant {
          padding: 11px;
          border: 1px solid #e4e8ef;
          border-radius: 5px 15px 15px 15px;
          background: #ffffff;
          color: #344054;
          box-shadow: 0 5px 15px rgba(3, 21, 63, 0.05);
        }

        .ncsAiUser {
          margin-left: auto;
          padding: 11px;
          border-radius: 15px 5px 15px 15px;
          background: linear-gradient(135deg, #0a2e73, #164ba8);
          color: #ffffff;
        }

        .ncsAiProducts {
          display: grid;
          gap: 7px;
          margin-top: 10px;
        }

        .ncsAiProduct {
          width: 100%;
          display: grid;
          grid-template-columns: 58px minmax(0, 1fr);
          gap: 9px;
          padding: 7px;
          border: 1px solid #e6e9ef;
          border-radius: 11px;
          background: #ffffff;
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .ncsAiProductImage {
          width: 58px;
          height: 68px;
          display: grid;
          place-items: center;
          overflow: hidden;
          border-radius: 8px;
          background: #edf1f8;
          color: #d4af37;
          font-size: 11px;
          font-weight: 950;
        }

        .ncsAiProductImage img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ncsAiProductInfo {
          min-width: 0;
        }

        .ncsAiProductInfo strong,
        .ncsAiProductInfo span,
        .ncsAiProductInfo small,
        .ncsAiProductInfo em {
          display: block;
        }

        .ncsAiProductInfo strong {
          overflow: hidden;
          color: #0a2e73;
          font-size: 10px;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsAiProductInfo span {
          margin-top: 4px;
          color: #c19a21;
          font-size: 11px;
          font-weight: 950;
        }

        .ncsAiProductInfo del {
          margin-left: 6px;
          color: #98a2b3;
          font-size: 8px;
          font-weight: 700;
        }

        .ncsAiProductInfo small {
          margin-top: 3px;
          color: #067647;
          font-size: 8px;
          font-weight: 800;
        }

        .ncsAiProductInfo em {
          margin-top: 4px;
          overflow: hidden;
          color: #667085;
          font-size: 7.5px;
          font-style: normal;
          line-height: 1.35;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ncsAiTyping {
          width: fit-content;
          display: flex;
          gap: 4px;
          padding: 10px 12px;
          border-radius: 5px 15px 15px 15px;
          background: #ffffff;
        }

        .ncsAiTyping span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #0a2e73;
          animation: ncsAiBounce 1s infinite ease-in-out;
        }

        .ncsAiTyping span:nth-child(2) {
          animation-delay: 0.12s;
        }

        .ncsAiTyping span:nth-child(3) {
          animation-delay: 0.24s;
        }

        @keyframes ncsAiBounce {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.45;
          }

          30% {
            transform: translateY(-4px);
            opacity: 1;
          }
        }

        .ncsAiForm {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 8px;
          padding: 10px;
          border-top: 1px solid #e8ebf1;
          background: #ffffff;
        }

        .ncsAiForm textarea {
          width: 100%;
          min-height: 42px;
          max-height: 100px;
          resize: none;
          padding: 11px 12px;
          border: 1px solid #d8dee9;
          border-radius: 12px;
          outline: none;
          color: #344054;
          font: inherit;
          font-size: 10px;
          line-height: 1.4;
        }

        .ncsAiForm textarea:focus {
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.12);
        }

        .ncsAiForm > button {
          width: 42px;
          height: 42px;
          align-self: end;
          border: 0;
          border-radius: 12px;
          background: linear-gradient(135deg, #d4af37, #f0d36e);
          color: #0a2e73;
          font-size: 16px;
          font-weight: 950;
          cursor: pointer;
        }

        .ncsAiForm > button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .ncsAiPanel footer {
          padding: 7px 10px 9px;
          background: #ffffff;
          color: #98a2b3;
          font-size: 7.5px;
          font-weight: 700;
          text-align: center;
        }

        @media (max-width: 600px) {
          .ncsAiLauncher {
            right: 12px;
            bottom: 12px;
            min-height: 52px;
            padding-right: 13px;
          }

          .ncsAiSpark {
            width: 36px;
            height: 36px;
            flex-basis: 36px;
            font-size: 19px;
          }

          .ncsAiLauncherText small {
            display: none;
          }

          .ncsAiPanel {
            right: 8px;
            bottom: 72px;
            width: calc(100vw - 16px);
            height: min(650px, calc(100dvh - 84px));
            border-radius: 20px;
          }
        }
      `}</style>
    </>
  );
}