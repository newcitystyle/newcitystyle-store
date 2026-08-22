"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClubMember = {
  id: number;
  name: string;
  phone_normalized: string;
  voucher_code: string;
  voucher_amount: number | string;
  minimum_order_amount: number | string;
  payment_method_required: string;
  voucher_status: string;
  voucher_expires_at: string;
  used_at: string | null;
  used_order_id: string | null;
  whatsapp_status: string;
  created_at: string;
};

const PAGE_SIZE = 10;

export default function NcsClubMembersPage() {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  async function loadMembers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ncs_club_members")
        .select(
          "id,name,phone_normalized,voucher_code,voucher_amount,minimum_order_amount,payment_method_required,voucher_status,voucher_expires_at,used_at,used_order_id,whatsapp_status,created_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMembers((data || []) as ClubMember[]);
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Unable to load NEW CITY STYLE Club members.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMembers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;

    return members.filter((member) =>
      [
        member.name,
        member.phone_normalized,
        member.voucher_code,
        member.voucher_status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [members, search]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search]);

  return (
    <main className="clubAdmin">
      <div className="shell">
        <section className="hero">
          <div>
            <span>NEW CITY STYLE • CUSTOMER CLUB</span>
            <h1>NCS Club Members</h1>
            <p>
              Website subscribers, personal ₹100 welcome vouchers and redemption
              status.
            </p>
          </div>

          <div className="heroActions">
            <strong>{members.length}</strong>
            <small>Total Members</small>
            <button type="button" onClick={() => void loadMembers()}>
              Refresh
            </button>
          </div>
        </section>

        <section className="toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, mobile, voucher..."
          />
          <span>
            Showing {visible.length} of {filtered.length}
          </span>
        </section>

        <section className="card">
          {loading ? (
            <div className="empty">Loading Club members...</div>
          ) : visible.length === 0 ? (
            <div className="empty">No Club members found.</div>
          ) : (
            <div className="tableWrap">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Mobile</th>
                    <th>Voucher</th>
                    <th>Offer</th>
                    <th>Status</th>
                    <th>Joined</th>
                    <th>Used Order</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <small>#{member.id}</small>
                      </td>
                      <td>{member.phone_normalized}</td>
                      <td>
                        <code>{member.voucher_code}</code>
                      </td>
                      <td>
                        ₹{Number(member.voucher_amount || 0).toFixed(0)}
                        <small>
                          Min ₹
                          {Number(member.minimum_order_amount || 0).toFixed(0)} •{" "}
                          {member.payment_method_required}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${member.voucher_status}`}
                        >
                          {member.voucher_status}
                        </span>
                      </td>
                      <td>
                        {new Date(member.created_at).toLocaleDateString("en-IN")}
                      </td>
                      <td>{member.used_order_id || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="pager">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              ← Previous
            </button>
            <strong>
              Page {safePage} / {pages}
            </strong>
            <button
              type="button"
              disabled={safePage >= pages}
              onClick={() => setPage((value) => Math.min(pages, value + 1))}
            >
              Next →
            </button>
          </div>
        </section>
      </div>

      <style jsx>{`
        .clubAdmin {
          min-height: 100vh;
          padding: 24px;
          background: #f5f7fb;
          color: #263247;
          font-family: Poppins, Inter, Arial, sans-serif;
        }
        .shell { max-width: 1450px; margin: 0 auto; }
        .hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding: 28px;
          border-radius: 22px;
          background: linear-gradient(135deg, #03153f, #0a2e73);
          color: white;
          box-shadow: 0 18px 45px rgba(10,46,115,.2);
        }
        .hero span { color: #e8cb67; font-size: 10px; font-weight: 900; letter-spacing: 1px; }
        .hero h1 { margin: 5px 0 0; font-size: 34px; }
        .hero p { margin: 8px 0 0; color: rgba(255,255,255,.72); font-size: 12px; }
        .heroActions { display: grid; grid-template-columns: auto auto; align-items: center; gap: 2px 10px; }
        .heroActions strong { grid-row: span 2; font-size: 34px; color: #f0d467; }
        .heroActions small { font-size: 9px; }
        .heroActions button {
          margin-top: 5px; padding: 8px 12px; border: 1px solid rgba(255,255,255,.25);
          border-radius: 9px; background: rgba(255,255,255,.1); color: white; cursor: pointer;
        }
        .toolbar {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          margin-top: 15px; padding: 14px; border: 1px solid #e3e7ef; border-radius: 14px; background: white;
        }
        .toolbar input {
          width: min(520px, 100%); height: 44px; padding: 0 13px; border: 1px solid #d6dde8; border-radius: 10px;
        }
        .toolbar span { color: #7a8494; font-size: 10px; }
        .card {
          margin-top: 12px; padding: 16px; border: 1px solid #e3e7ef; border-radius: 16px; background: white;
          box-shadow: 0 12px 30px rgba(10,46,115,.05);
        }
        .tableWrap { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; min-width: 980px; }
        th, td { padding: 13px 11px; border-bottom: 1px solid #eef1f5; text-align: left; font-size: 11px; }
        th { color: #6f7888; font-size: 9px; text-transform: uppercase; letter-spacing: .5px; }
        td strong, td small { display: block; }
        td small { margin-top: 3px; color: #8a93a1; font-size: 8px; }
        code { padding: 6px 8px; border-radius: 7px; background: #f4f0ff; color: #5b42b6; font-weight: 900; }
        .badge { display: inline-block; padding: 6px 9px; border-radius: 999px; font-size: 8px; font-weight: 900; text-transform: uppercase; }
        .badge-active { background: #eaf8ef; color: #177847; }
        .badge-used { background: #eef2ff; color: #4e5c9f; }
        .badge-expired, .badge-disabled { background: #fff0f0; color: #a33f3f; }
        .pager { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 15px; }
        .pager button { padding: 9px 12px; border: 1px solid #d9e0ea; border-radius: 9px; background: white; cursor: pointer; }
        .pager button:disabled { opacity: .45; cursor: not-allowed; }
        .pager strong { color: #0a2e73; font-size: 10px; }
        .empty { padding: 35px; color: #7c8594; text-align: center; }
        @media (max-width: 700px) {
          .clubAdmin { padding: 12px; }
          .hero { align-items: stretch; flex-direction: column; }
          .toolbar { align-items: stretch; flex-direction: column; }
        }
      `}</style>
    </main>
  );
}