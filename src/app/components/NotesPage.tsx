interface NoteEntry {
  year?: string;
  title: string;
  month: string;
}

const NOTE_ENTRIES: NoteEntry[] = [
  { year: "2026", title: "Living without regrets", month: "January" },
  { year: "2025", title: "1A", month: "December" },
  { title: "Elitism", month: "November" },
];

export default function NotesPage() {
  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_center,_#f7f7f7_0%,_#ececec_52%,_#d1d1d1_100%)] text-[#1c1c1c]">
      <section className="mx-auto flex min-h-screen max-w-[700px] items-center px-5 py-14 sm:px-8">
        <div className="w-full">
          {NOTE_ENTRIES.map((entry) => (
            <div
              key={`${entry.year ?? "same-year"}-${entry.title}`}
              className="grid grid-cols-[64px_minmax(0,1fr)_84px] items-center gap-3 border-b border-black/[0.055] py-5 sm:grid-cols-[96px_minmax(0,1fr)_140px] sm:gap-7 sm:py-7"
            >
              <span className="text-[18px] font-normal tracking-[-0.008em] text-black/34 sm:text-[32px]">
                {entry.year ?? ""}
              </span>
              <span className="truncate text-[22px] font-medium tracking-[-0.012em] sm:text-[40px]">
                {entry.title}
              </span>
              <span className="text-right text-[18px] font-normal tracking-[-0.008em] text-black/32 sm:text-[34px]">
                {entry.month}
              </span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
