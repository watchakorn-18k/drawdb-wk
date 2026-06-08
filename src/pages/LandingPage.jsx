import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import SimpleCanvas from "../components/SimpleCanvas";
import Navbar from "../components/Navbar";
import { diagram } from "../data/heroDiagram";
import mysql_icon from "../assets/mysql.png";
import postgres_icon from "../assets/postgres.png";
import sqlite_icon from "../assets/sqlite.png";
import mariadb_icon from "../assets/mariadb.png";
import oraclesql_icon from "../assets/oraclesql.png";
import sql_server_icon from "../assets/sql-server.png";
import discord from "../assets/discord.png";
import github from "../assets/github.png";
import screenshot from "../assets/screenshot.png";
import FadeIn from "../animations/FadeIn";
import axios from "axios";
import { languages } from "../i18n/i18n";
import SafeTweet from "../components/SafeTweet";
import { socials } from "../data/socials";

function shortenNumber(number) {
  if (typeof number !== "number" || Number.isNaN(number)) return number;
  if (number < 1000) return number;
  if (number < 1_000_000) return `${(number / 1000).toFixed(1)}k`;

  return `${(number / 1_000_000).toFixed(1)}m`;
}

export default function LandingPage() {
  const [stats, setStats] = useState({ stars: 18000, forks: 1200 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get(
          "https://api.github-star-counter.workers.dev/user/drawdb-io",
        );
        if (res.data?.stars > 0 && res.data?.forks > 0) {
          setStats(res.data);
        }
      } catch {
        setStats({ stars: 18000, forks: 1200 });
      }
    };

    document.body.setAttribute("theme-mode", "light");
    document.title =
      "drawDB WK | Online database diagram editor and SQL generator";

    fetchStats();
  }, []);

  const statItems = [
    { value: stats.stars, label: "GitHub stars" },
    { value: stats.forks, label: "GitHub forks" },
    { value: languages.length, label: "Languages" },
  ];
  const heroCanvasOrigin = { x: -window.innerWidth * 0.65 + 48, y: 32 };

  return (
    <main className="lp min-h-full overflow-hidden bg-[#f6f3ee] text-zinc-950">
      <section className="relative min-h-[100dvh] bg-[#f6f3ee]">
        <div className="pointer-events-none absolute inset-0 lp-grid opacity-70" />
        <div className="relative">
          <FadeIn duration={0.6}>
            <Navbar />
          </FadeIn>
        </div>

        <div className="relative mx-auto grid min-h-[calc(100dvh-90px)] max-w-7xl grid-cols-[0.9fr_1.1fr] items-center gap-10 px-8 pb-16 pt-8 md:grid-cols-1 md:px-5 md:pb-10">
          <FadeIn duration={0.75}>
            <div className="max-w-xl">
              <div className="mb-5 inline-flex items-center gap-3 rounded-full border border-zinc-300/70 bg-white/70 px-4 py-2 text-sm font-semibold text-zinc-700 backdrop-blur">
                <span className="h-2 w-2 rounded-full bg-[#12495e]" />
                Open-source database diagram editor
              </div>
              <h1 className="max-w-3xl text-[clamp(3.75rem,8vw,7.5rem)] font-extrabold leading-[0.86] tracking-[-0.075em] text-balance">
                Draw schemas. Ship SQL.
              </h1>
              <p className="mt-6 max-w-lg text-xl font-medium leading-8 text-zinc-700 text-pretty md:text-lg md:leading-7">
                Design database diagrams in your browser, import existing DDL,
                export scripts, and keep everything local until you choose to
                share.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3 font-semibold">
                <Link
                  to="/editor"
                  className="inline-flex items-center rounded-full bg-[#12495e] px-7 py-3.5 text-white shadow-[0_18px_40px_rgba(18,73,94,0.22)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#0d3d50] focus:outline-none focus:ring-2 focus:ring-[#12495e] focus:ring-offset-2 active:scale-[0.98]"
                >
                  Try it for yourself <i className="bi bi-arrow-right ms-2" />
                </Link>
                <button
                  className="rounded-full border border-zinc-300 bg-white/80 px-7 py-3.5 text-zinc-900 transition-all duration-300 hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#12495e] focus:ring-offset-2 active:scale-[0.98]"
                  onClick={() =>
                    document
                      .getElementById("learn-more")
                      .scrollIntoView({ behavior: "smooth" })
                  }
                >
                  See workflow
                </button>
              </div>
              <div className="mt-10 grid max-w-md grid-cols-3 gap-4 border-y border-zinc-300/70 py-5 sm:grid-cols-1 sm:gap-3">
                {statItems.map((item) => (
                  <div key={item.label}>
                    <div className="font-mono-lp text-2xl font-semibold tracking-[-0.04em] text-[#12495e]">
                      {shortenNumber(item.value)}
                    </div>
                    <div className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </FadeIn>

          <FadeIn duration={0.9}>
            <div className="relative md:mt-4">
              <div className="absolute -inset-6 rounded-[2.5rem] bg-[#12495e]/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[2rem] border border-zinc-300/80 bg-[#101820] p-3 shadow-[0_30px_80px_rgba(18,73,94,0.22)]">
                <div className="mb-3 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-white/80">
                  <div className="flex gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#ff6b6b]" />
                    <span className="h-3 w-3 rounded-full bg-[#ffd166]" />
                    <span className="h-3 w-3 rounded-full bg-[#6ee7b7]" />
                  </div>
                  <span className="font-mono-lp text-xs uppercase tracking-[0.24em]">
                    live diagram
                  </span>
                </div>
                <div className="h-[620px] overflow-hidden rounded-3xl bg-white md:h-[420px] sm:h-[360px]">
                  <SimpleCanvas
                    diagram={diagram}
                    zoom={0.85}
                    origin={heroCanvasOrigin}
                  />
                </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <section id="learn-more" className="bg-[#f6f3ee] px-8 py-24 md:px-5 md:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8">
            <div className="rounded-[2.5rem] bg-[#171f26] p-4 shadow-[0_30px_80px_rgba(23,31,38,0.2)]">
              <div className="rounded-[2rem] bg-[#f8f7f4] p-5">
                <div className="mb-5 flex items-end justify-between gap-4 md:block">
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#12495e]">
                      Browser-first workspace
                    </div>
                    <h2 className="mt-2 max-w-2xl text-4xl font-bold leading-none tracking-[-0.06em] text-balance md:text-3xl">
                      Build diagrams, see structure, export SQL.
                    </h2>
                  </div>
                  <div className="max-w-sm text-sm font-medium leading-6 text-zinc-600 md:mt-4">
                    No account gate. Your diagrams stay in your browser by
                    default, ready to export or back up.
                  </div>
                </div>
                <img
                  src={screenshot}
                  alt="drawDB workspace showing database tables and relationships"
                  className="mx-auto rounded-2xl"
                />
              </div>
            </div>
          </div>

          <div className="mt-20">
            <div className="mb-6 flex items-end justify-between gap-6 md:block">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Dialects
                </div>
                <h2 className="mt-2 text-4xl font-bold tracking-[-0.05em] md:text-3xl">
                  Design for your database
                </h2>
              </div>
              <p className="max-w-lg text-lg font-medium leading-7 text-zinc-600 md:mt-3 md:text-base">
                Work across common SQL dialects and generate scripts from the
                same visual model.
              </p>
            </div>
            <div className="grid grid-cols-6 gap-3 rounded-[2rem] border border-zinc-300/80 bg-white/60 p-4 md:grid-cols-3 sm:grid-cols-2">
              {dbs.map((db) => (
                <div
                  key={db.name}
                  className="flex min-h-28 items-center justify-center rounded-3xl bg-[#f7f4ef] p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white"
                >
                  <img
                    src={db.icon}
                    alt={`${db.name} logo`}
                    style={{ height: db.height }}
                    className="max-w-full object-contain opacity-70 transition-opacity duration-300 hover:opacity-100 md:scale-[0.82]"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-[#fffdf8] px-8 py-24 md:px-5 md:py-16">
        <FadeIn duration={1}>
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 grid grid-cols-[0.8fr_1.2fr] gap-10 md:grid-cols-1 md:gap-4">
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#12495e]">
                More than an editor
              </div>
              <div>
                <h2 className="max-w-3xl text-5xl font-bold leading-[0.95] tracking-[-0.06em] text-balance md:text-3xl">
                  Design the schema, then ship the SQL
                </h2>
                <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-zinc-600 md:text-base md:leading-7">
                  Import an existing database, shape the model visually, then
                  export documentation, images, DDL, or migrations when the
                  diagram is ready.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-4 md:grid-cols-2 sm:grid-cols-1">
              {features.map((feature, index) => (
                <article
                  key={feature.title}
                  className={`${featureSpans[index]} group min-h-48 rounded-[1.75rem] bg-[#f0ece3] p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-[#e9e2d5] md:col-span-1`}
                >
                  <div className="mb-8 flex items-center justify-between gap-4">
                    <span className="font-mono-lp text-sm font-semibold text-[#12495e]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="h-px flex-1 bg-zinc-300 transition-colors duration-300 group-hover:bg-[#12495e]/40" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-[-0.04em]">
                    {feature.title}
                  </h3>
                  <div className="mt-4 max-w-md text-base font-medium leading-7 text-zinc-600">
                    {feature.content}
                  </div>
                  {feature.footer && (
                    <div className="mt-3 text-xs opacity-60">
                      {feature.footer}
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      <section className="bg-[#fffdf8] px-8 pb-24 md:px-5 md:pb-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between gap-6 md:block">
            <h2 className="max-w-lg text-4xl font-bold tracking-[-0.05em] md:text-3xl">
              What builders say about drawDB
            </h2>
            <p className="max-w-md text-base font-medium leading-7 text-zinc-600 md:mt-3">
              Public notes from people using drawDB for schema design,
              teaching, and quick database planning.
            </p>
          </div>
          <div
            data-theme="light"
            className="grid grid-cols-2 items-start gap-5 md:grid-cols-1"
          >
            <div className="space-y-5">
              <SafeTweet id="1816111365125218343" />
              <SafeTweet id="1785457354777006524" />
            </div>
            <div className="mt-14 space-y-5 md:mt-0">
              <SafeTweet id="1817933406337905021" />
              <SafeTweet id="1776842268042756248" />
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f6f3ee] px-8 py-20 md:px-5 md:py-14">
        <div className="mx-auto max-w-7xl rounded-[2.5rem] bg-[#111b22] p-10 text-white shadow-[0_30px_80px_rgba(17,27,34,0.24)] md:p-6">
          <div className="grid grid-cols-[0.85fr_1.15fr] items-end gap-10 md:grid-cols-1">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
                Reach out
              </div>
              <h2 className="mt-3 text-5xl font-bold leading-[0.95] tracking-[-0.06em] text-balance md:text-3xl">
                Join the people building databases visually.
              </h2>
              <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-white/65 md:text-base md:leading-7">
                We read GitHub issues, Discord notes, and pull requests. Tell us
                what should be better.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
              <a
                className="group flex items-center gap-4 rounded-2xl bg-white px-5 py-4 text-zinc-950 transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#111b22] active:scale-[0.98]"
                href={socials.github}
                target="_blank"
                rel="noreferrer"
              >
                <img src={github} alt="GitHub logo" className="h-8" />
                <span className="text-lg font-bold">See the source</span>
              </a>
              <a
                className="group flex items-center gap-4 rounded-2xl bg-[#5865f2] px-5 py-4 text-white transition-all duration-300 hover:-translate-y-1 hover:bg-[#4f5ce0] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#111b22] active:scale-[0.98]"
                href={socials.discord}
                target="_blank"
                rel="noreferrer"
              >
                <img src={discord} alt="Discord logo" className="h-8" />
                <span className="text-lg font-bold">Join Discord</span>
              </a>
              <a
                className="group flex items-center gap-4 rounded-2xl bg-white/10 px-5 py-4 text-white transition-all duration-300 hover:-translate-y-1 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#111b22] active:scale-[0.98]"
                href={socials.twitter}
                target="_blank"
                rel="noreferrer"
              >
                <i className="text-2xl bi bi-twitter-x" />
                <span className="text-lg font-bold">Follow on X</span>
              </a>
              <a
                className="group flex items-center gap-4 rounded-2xl border border-rose-300/40 bg-rose-300/10 px-5 py-4 text-white transition-all duration-300 hover:-translate-y-1 hover:bg-rose-300/15 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#111b22] active:scale-[0.98]"
                href={socials.sponsor}
                target="_blank"
                rel="noreferrer"
              >
                <span className="relative text-2xl leading-none">
                  <i className="fa-solid fa-heart text-rose-300" />
                  <i className="absolute left-0 top-0 fa-regular fa-heart text-rose-100" />
                </span>
                <span className="text-lg font-bold">Support us</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-[#f6f3ee] text-center">
        <div className="bg-red-800 px-3 py-2 text-xs font-semibold text-white">
          Attention: diagrams are saved in your browser. Before clearing the
          browser, back up your data.
        </div>
        <div className="border-t border-zinc-300 py-4 text-sm text-zinc-600">
          &copy; {new Date().getFullYear()} <strong>drawDB WK</strong> - All
          rights reserved.
        </div>
      </footer>
    </main>
  );
}

const dbs = [
  { name: "MySQL", icon: mysql_icon, height: 80 },
  { name: "PostgreSQL", icon: postgres_icon, height: 48 },
  { name: "SQLite", icon: sqlite_icon, height: 64 },
  { name: "MariaDB", icon: mariadb_icon, height: 64 },
  { name: "SQL Server", icon: sql_server_icon, height: 64 },
  { name: "Oracle SQL", icon: oraclesql_icon, height: 120 },
];

const featureSpans = [
  "col-span-7",
  "col-span-5",
  "col-span-4",
  "col-span-4",
  "col-span-4",
  "col-span-5",
  "col-span-7",
  "col-span-4",
  "col-span-4",
  "col-span-4",
  "col-span-6",
  "col-span-6",
];

const features = [
  {
    title: "Export",
    content: (
      <div>
        Export the DDL script to run on your database or export the diagram as a
        JSON or an image.
      </div>
    ),
    footer: "",
  },
  {
    title: "Reverse engineer",
    content: (
      <div>
        Already have a schema? Import a DDL script to generate a diagram.
      </div>
    ),
    footer: "",
  },
  {
    title: "Generate migrations",
    content: (
      <div>
        Version your diagram and generate migration scripts to update your
        database.
      </div>
    ),
    footer: "",
  },
  {
    title: "Customizable workspace",
    content: (
      <div>
        Customize the UI to fit your preferences. Select the components you want
        in your view.
      </div>
    ),
    footer: "",
  },
  {
    title: "Keyboard shortcuts",
    content: (
      <div>
        Speed up development with keyboard shortcuts. See all available
        shortcuts
        <Link
          to={`${socials.docs}/shortcuts`}
          className="ms-1.5 text-[#12495e] underline decoration-[#12495e]/30 underline-offset-4 hover:decoration-[#12495e]"
        >
          here
        </Link>
        .
      </div>
    ),
    footer: "",
  },
  {
    title: "Templates",
    content: (
      <div>
        Start off with pre-built templates. Get a quick start or get inspiration
        for your design.
      </div>
    ),
    footer: "",
  },
  {
    title: "Custom templates",
    content: (
      <div>
        Have boilerplate structures? Save time by saving them as templates and
        load them when needed.
      </div>
    ),
    footer: "",
  },
  {
    title: "Robust editor",
    content: (
      <div>
        Undo, redo, copy, paste, duplicate and more. Add tables, subject areas,
        and notes.
      </div>
    ),
    footer: "",
  },
  {
    title: "Issue detection",
    content: (
      <div>
        Detect and tackle errors in the diagram to make sure the scripts are
        correct.
      </div>
    ),
    footer: "",
  },
  {
    title: "Relational databases",
    content: (
      <div>
        We support MySQL, PostgreSQL, SQLite, MariaDB, SQL Server, and Oracle
        SQL.
      </div>
    ),
    footer: "",
  },
  {
    title: "Object-relational databases",
    content: (
      <div>
        Add custom types for object-relational databases, or create custom JSON
        schemas.
      </div>
    ),
    footer: "",
  },
  {
    title: "Presentation mode",
    content: (
      <div>
        Present your diagrams on a big screen during team meetings and
        discussions.
      </div>
    ),
    footer: "",
  },
];
