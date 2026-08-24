import { Check, ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const REGION_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
YE YT
ZA ZM ZW
`.trim().split(/\s+/);

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

const COUNTRIES = REGION_CODES
  .map((code) => ({ code, name: displayNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

function flagUrl(code: string) {
  return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
}

export function CountrySelect({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => COUNTRIES.find((country) => country.name === value) ?? null,
    [value],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return COUNTRIES;
    return COUNTRIES.filter(
      (country) =>
        country.name.toLowerCase().includes(normalized) ||
        country.code.toLowerCase().includes(normalized),
    );
  }, [query]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => searchRef.current?.focus(), 0);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function selectCountry(country: { code: string; name: string }) {
    onChange(country.name);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="block">
      <span className="mb-1.5 block text-sm font-semibold">Country or territory</span>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 text-left text-sm outline-none transition focus:ring-2 focus:ring-teal/40 disabled:cursor-not-allowed disabled:opacity-60",
            open && "border-teal/50 ring-2 ring-teal/20",
          )}
        >
          {selected ? (
            <>
              <img
                src={flagUrl(selected.code)}
                alt=""
                className="h-4 w-6 shrink-0 rounded-sm border border-border/70 object-cover shadow-sm"
              />
              <span className="min-w-0 flex-1 truncate">{selected.name}</span>
            </>
          ) : (
            <span className="flex-1 text-muted-foreground">Select country or territory</span>
          )}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition", open && "rotate-180")} />
        </button>

        {open && (
          <div className="absolute left-0 right-0 z-[80] mt-2 overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
            <div className="border-b border-border p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search country or territory"
                  autoComplete="off"
                  className="w-full rounded-xl border border-border bg-background py-2.5 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-teal/40"
                />
              </div>
            </div>

            <div role="listbox" aria-label="Country or territory" className="max-h-72 overflow-y-auto p-2">
              {filtered.length ? (
                filtered.map((country) => {
                  const active = country.name === value;
                  return (
                    <button
                      key={country.code}
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => selectCountry(country)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-secondary",
                        active && "bg-teal/10 font-semibold text-navy-deep",
                      )}
                    >
                      <img
                        src={flagUrl(country.code)}
                        alt=""
                        loading="lazy"
                        className="h-4 w-6 shrink-0 rounded-sm border border-border/70 object-cover shadow-sm"
                      />
                      <span className="min-w-0 flex-1 truncate">{country.name}</span>
                      {active && <Check className="h-4 w-4 shrink-0 text-teal" />}
                    </button>
                  );
                })
              ) : (
                <div className="px-3 py-7 text-center text-sm text-muted-foreground">No matching country or territory.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
