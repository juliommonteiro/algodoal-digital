import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BedDouble,
  Bell,
  BookOpen,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Compass,
  Eye,
  EyeOff,
  Heart,
  Home,
  Leaf,
  LocateFixed,
  LogIn,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Minus,
  Navigation,
  Phone,
  Plus,
  Recycle,
  RefreshCw,
  Route,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  TicketCheck,
  Trees,
  Truck,
  UserRound,
  Users,
  Utensils,
  Waves,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "inicio" | "mapa" | "diretorio" | "carroca" | "passaporte";
type Category = "Todos" | "Praias" | "Comer" | "Hospedar" | "Passeios";

type Place = {
  id: number;
  name: string;
  category: Exclude<Category, "Todos">;
  description: string;
  distance: string;
  rating: number;
  open: boolean;
  accent: string;
  icon: React.ElementType;
  tags: string[];
};

const navItems: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "mapa", label: "Mapa", icon: Map },
  { id: "diretorio", label: "Explorar", icon: Compass },
  { id: "carroca", label: "Carroça", icon: Truck },
  { id: "passaporte", label: "Passaporte", icon: BookOpen },
];

const places: Place[] = [
  {
    id: 1,
    name: "Praia da Princesa",
    category: "Praias",
    description: "Areia extensa, dunas e um dos melhores pores do sol da ilha.",
    distance: "1,2 km",
    rating: 4.9,
    open: true,
    accent: "from-cyan-400 via-sky-500 to-teal-800",
    icon: Waves,
    tags: ["Pôr do sol", "Banho", "Fotografia"],
  },
  {
    id: 2,
    name: "Cozinha da Maré",
    category: "Comer",
    description: "Peixes, frutos do mar e receitas paraenses feitas por moradores.",
    distance: "350 m",
    rating: 4.8,
    open: true,
    accent: "from-amber-300 via-orange-500 to-rose-600",
    icon: Utensils,
    tags: ["Regional", "Almoço", "Família"],
  },
  {
    id: 3,
    name: "Pousada Brisa do Norte",
    category: "Hospedar",
    description: "Quartos ventilados, jardim tropical e acesso rápido à vila.",
    distance: "600 m",
    rating: 4.7,
    open: true,
    accent: "from-violet-400 via-indigo-500 to-slate-900",
    icon: BedDouble,
    tags: ["Wi-Fi", "Café", "Jardim"],
  },
  {
    id: 4,
    name: "Trilha do Mangue",
    category: "Passeios",
    description: "Experiência guiada para conhecer o manguezal e sua biodiversidade.",
    distance: "2,4 km",
    rating: 4.9,
    open: false,
    accent: "from-lime-400 via-emerald-600 to-green-950",
    icon: Trees,
    tags: ["Guia", "Natureza", "2 horas"],
  },
  {
    id: 5,
    name: "Praia do Farol",
    category: "Praias",
    description: "Trecho tranquilo para caminhar, descansar e observar a maré.",
    distance: "3,1 km",
    rating: 4.6,
    open: true,
    accent: "from-sky-300 via-cyan-500 to-blue-900",
    icon: Waves,
    tags: ["Calma", "Caminhada", "Natureza"],
  },
  {
    id: 6,
    name: "Casa do Açaí",
    category: "Comer",
    description: "Açaí paraense, tapiocas e lanches rápidos no centro da vila.",
    distance: "180 m",
    rating: 4.8,
    open: true,
    accent: "from-fuchsia-400 via-purple-600 to-indigo-950",
    icon: Utensils,
    tags: ["Açaí", "Tapioca", "Rápido"],
  },
];

const categories: Array<{
  label: Exclude<Category, "Todos">;
  description: string;
  icon: React.ElementType;
  gradient: string;
}> = [
  {
    label: "Praias",
    description: "Areia, marés e pôr do sol",
    icon: Waves,
    gradient: "from-cyan-500 to-teal-700",
  },
  {
    label: "Comer",
    description: "Sabores da ilha",
    icon: Utensils,
    gradient: "from-orange-400 to-amber-600",
  },
  {
    label: "Hospedar",
    description: "Pousadas e acomodações",
    icon: BedDouble,
    gradient: "from-indigo-500 to-violet-700",
  },
  {
    label: "Passeios",
    description: "Trilhas e experiências",
    icon: Trees,
    gradient: "from-emerald-500 to-green-800",
  },
];

const spring = { type: "spring" as const, stiffness: 320, damping: 28 };

function IslandNetwork({ compact = false }: { compact?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const routes: ReadonlyArray<readonly [number, number, number, number]> = [
      [0.17, 0.69, 0.36, 0.42],
      [0.36, 0.42, 0.6, 0.3],
      [0.6, 0.3, 0.79, 0.56],
      [0.25, 0.28, 0.55, 0.7],
      [0.55, 0.7, 0.84, 0.35],
    ];

    let width = 0;
    let height = 0;
    const startedAt = performance.now();

    const resize = () => {
      const bounds = parent.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = bounds.width;
      height = bounds.height;
      canvas.width = Math.max(1, Math.floor(width * pixelRatio));
      canvas.height = Math.max(1, Math.floor(height * pixelRatio));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.getContext("2d")?.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    };

    const draw = (time: number) => {
      const context = canvas.getContext("2d");
      if (!context || !width || !height) {
        frameRef.current = requestAnimationFrame(draw);
        return;
      }

      context.clearRect(0, 0, width, height);
      const glow = context.createRadialGradient(
        width * 0.5,
        height * 0.48,
        0,
        width * 0.5,
        height * 0.48,
        width * 0.65,
      );
      glow.addColorStop(0, "rgba(45, 212, 191, 0.24)");
      glow.addColorStop(1, "rgba(15, 118, 110, 0)");
      context.fillStyle = glow;
      context.fillRect(0, 0, width, height);

      const gap = compact ? 15 : 13;
      for (let x = 0; x < width; x += gap) {
        for (let y = 0; y < height; y += gap) {
          const normalizedX = x / width;
          const normalizedY = y / height;
          const mainIsland =
            ((normalizedX - 0.42) ** 2) / 0.12 +
              ((normalizedY - 0.48) ** 2) / 0.18 <
            1;
          const secondaryIsland =
            ((normalizedX - 0.68) ** 2) / 0.035 +
              ((normalizedY - 0.58) ** 2) / 0.08 <
            1;
          const lagoon =
            ((normalizedX - 0.48) ** 2) / 0.018 +
              ((normalizedY - 0.46) ** 2) / 0.035 <
            1;
          const edgeNoise = Math.sin(x * 0.08) + Math.cos(y * 0.11);
          if ((mainIsland || secondaryIsland) && !lagoon && edgeNoise > -1.25) {
            const shimmer = 0.25 + ((Math.sin(x + y) + 1) / 2) * 0.32;
            context.beginPath();
            context.arc(x, y, compact ? 1.1 : 1.35, 0, Math.PI * 2);
            context.fillStyle = `rgba(255,255,255,${shimmer})`;
            context.fill();
          }
        }
      }

      const elapsed = reducedMotion ? 1 : ((time - startedAt) / 9000) % 1;
      routes.forEach(([startXRatio, startYRatio, endXRatio, endYRatio], index) => {
        const startX = startXRatio * width;
        const startY = startYRatio * height;
        const endX = endXRatio * width;
        const endY = endYRatio * height;
        const progress = Math.max(0, Math.min(1, elapsed * 1.65 - index * 0.12));
        const currentX = startX + (endX - startX) * progress;
        const currentY = startY + (endY - startY) * progress;

        context.beginPath();
        context.moveTo(startX, startY);
        context.lineTo(currentX, currentY);
        context.strokeStyle = "rgba(254, 240, 138, 0.85)";
        context.lineWidth = compact ? 1.1 : 1.5;
        context.stroke();

        context.beginPath();
        context.arc(startX, startY, compact ? 2.4 : 3, 0, Math.PI * 2);
        context.fillStyle = "rgb(254 240 138)";
        context.fill();

        if (progress > 0 && progress < 1) {
          context.beginPath();
          context.arc(currentX, currentY, compact ? 3 : 4, 0, Math.PI * 2);
          context.fillStyle = "rgb(255 255 255)";
          context.fill();
          context.beginPath();
          context.arc(currentX, currentY, compact ? 7 : 9, 0, Math.PI * 2);
          context.fillStyle = "rgba(255,255,255,0.16)";
          context.fill();
        }
      });

      if (!reducedMotion) frameRef.current = requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    resize();
    frameRef.current = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [compact]);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />;
}

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 via-cyan-600 to-slate-950 text-white shadow-lg shadow-teal-950/15">
        <Waves className="h-6 w-6" />
        <span className="absolute bottom-1 right-1 h-2 w-2 rounded-full bg-amber-300 ring-2 ring-teal-900" />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-teal-700">
          Ilha de Maiandeua
        </p>
        <p className="text-lg font-extrabold tracking-tight text-slate-950">
          Algodoal Digital
        </p>
      </div>
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200/80 bg-white/85 text-slate-600 transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 motion-reduce:transform-none"
    >
      {children}
    </button>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
  className,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <motion.button
      type={type}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-cyan-600 px-5 text-sm font-bold text-white shadow-lg shadow-teal-900/15 transition hover:shadow-xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none motion-reduce:transform-none",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

function SecondaryButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20 motion-reduce:transform-none",
        className,
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ offline, onClick }: { offline: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-4",
        offline
          ? "border-amber-200 bg-amber-50 text-amber-800 focus-visible:ring-amber-500/20"
          : "border-emerald-200 bg-emerald-50 text-emerald-800 focus-visible:ring-emerald-500/20",
      )}
    >
      <span
        className={cn(
          "relative flex h-2.5 w-2.5 rounded-full",
          offline ? "bg-amber-500" : "bg-emerald-500",
        )}
      >
        {!offline && (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        )}
      </span>
      {offline ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{offline ? "Modo offline" : "Conectado"}</span>
    </button>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block w-full">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-2xl border border-slate-200/90 bg-white/90 pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10"
      />
    </label>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-5">
      <div>
        {eyebrow && (
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-teal-700">
            {eyebrow}
          </p>
        )}
        <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
          {title}
        </h2>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 sm:text-base">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

function PlaceVisual({ place, large }: { place: Place; large?: boolean }) {
  const Icon = place.icon;
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-gradient-to-br",
        place.accent,
        large ? "h-56 rounded-[1.75rem]" : "h-40 rounded-[1.4rem]",
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.38),transparent_32%),linear-gradient(155deg,transparent_40%,rgba(15,23,42,0.45))]" />
      <div className="absolute -bottom-14 -right-10 h-44 w-44 rounded-full border-[24px] border-white/10" />
      <div className="absolute left-5 top-5 grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/15 text-white backdrop-blur-md">
        <Icon className="h-5 w-5" />
      </div>
      <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3">
        <span className="rounded-full border border-white/20 bg-slate-950/25 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
          {place.category}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
          <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
          {place.rating.toFixed(1)}
        </span>
      </div>
    </div>
  );
}

function PlaceCard({ place, onOpen }: { place: Place; onOpen: (place: Place) => void }) {
  return (
    <motion.article
      layout
      whileHover={{ y: -5 }}
      transition={spring}
      className="group rounded-[1.8rem] border border-slate-200/80 bg-white p-2.5 shadow-[0_16px_45px_rgba(15,23,42,0.06)]"
    >
      <PlaceVisual place={place} />
      <div className="px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-extrabold tracking-tight text-slate-950 group-hover:text-teal-800">
              {place.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> {place.distance}
              </span>
              <span className="h-1 w-1 rounded-full bg-slate-300" />
              <span className={place.open ? "text-emerald-700" : "text-rose-700"}>
                {place.open ? "Aberto agora" : "Fechado"}
              </span>
            </div>
          </div>
          <button
            type="button"
            aria-label={`Salvar ${place.name}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-400/20"
          >
            <Heart className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-500">{place.description}</p>
        <button
          type="button"
          onClick={() => onOpen(place)}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-extrabold text-teal-700 transition hover:gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
        >
          Ver detalhes <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </motion.article>
  );
}

function HomeScreen({
  onNavigate,
  onOpenPlace,
}: {
  onNavigate: (tab: Tab) => void;
  onOpenPlace: (place: Place) => void;
}) {
  const [search, setSearch] = useState("");

  return (
    <motion.div
      key="home"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28 }}
      className="space-y-9"
    >
      <section className="relative min-h-[430px] overflow-hidden rounded-[2.25rem] bg-slate-950 shadow-[0_30px_90px_rgba(15,23,42,0.22)] sm:min-h-[470px]">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-slate-950 to-cyan-950" />
        <IslandNetwork />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(2,44,43,0.92)_0%,rgba(2,44,43,0.72)_42%,rgba(2,44,43,0.08)_78%)]" />
        <div className="relative z-10 flex min-h-[430px] max-w-3xl flex-col justify-center p-7 sm:min-h-[470px] sm:p-12 lg:p-16">
          <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-bold text-teal-50 backdrop-blur-md">
            <ShieldCheck className="h-4 w-4 text-amber-300" />
            Guias e serviços disponíveis mesmo sem internet
          </div>
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.45 }}
            className="max-w-2xl text-4xl font-black leading-[1.04] tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl"
          >
            A ilha inteira na palma da sua mão.
          </motion.h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-teal-50/75 sm:text-lg">
            Descubra praias, gastronomia, hospedagens, transporte local e experiências sustentáveis em Algodoal.
          </p>
          <div className="mt-7 max-w-xl rounded-[1.35rem] bg-white p-1.5 shadow-2xl shadow-black/20">
            <div className="flex items-center gap-2">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Buscar praia, pousada ou restaurante"
              />
              <button
                type="button"
                aria-label="Buscar"
                onClick={() => onNavigate("diretorio")}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-700 text-white transition hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/25"
              >
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-white/70">
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> 23 categorias locais
            </span>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-300" /> Mapa salvo no aparelho
            </span>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Encontre rápido"
          title="O que você procura?"
          description="Atalhos pensados para usar com uma mão, inclusive em conexões instáveis."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {categories.map((category, index) => {
            const Icon = category.icon;
            return (
              <motion.button
                key={category.label}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4 }}
                onClick={() => onNavigate(category.label === "Praias" ? "mapa" : "diretorio")}
                className="group flex items-center gap-4 rounded-[1.6rem] border border-slate-200/80 bg-white p-4 text-left shadow-[0_14px_40px_rgba(15,23,42,0.05)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
              >
                <span
                  className={cn(
                    "grid h-[52px] w-[52px] shrink-0 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-lg",
                    category.gradient,
                  )}
                >
                  <Icon className="h-6 w-6" />
                </span>
                <span>
                  <strong className="block text-sm font-extrabold text-slate-950 group-hover:text-teal-800">
                    {category.label}
                  </strong>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {category.description}
                  </span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeading
          eyebrow="Seleção da ilha"
          title="Destaques perto de você"
          description="Informações essenciais salvas para consultar mesmo quando o sinal desaparecer."
          action={
            <button
              type="button"
              onClick={() => onNavigate("diretorio")}
              className="hidden items-center gap-1.5 text-sm font-extrabold text-teal-700 hover:text-teal-900 sm:inline-flex"
            >
              Ver todos <ChevronRight className="h-4 w-4" />
            </button>
          }
        />
        <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {places.slice(0, 3).map((place) => (
            <PlaceCard key={place.id} place={place} onOpen={onOpenPlace} />
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="overflow-hidden rounded-[2rem] border border-emerald-200 bg-gradient-to-br from-emerald-950 via-teal-900 to-cyan-900 p-7 text-white shadow-xl shadow-emerald-950/15 sm:p-9">
          <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                <Recycle className="h-4 w-4" /> Turismo que cuida
              </div>
              <h3 className="mt-5 max-w-lg text-3xl font-black tracking-tight">
                Explore a ilha e deixe um impacto positivo.
              </h3>
              <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/70">
                Complete missões ambientais, registre check-ins e desbloqueie conquistas no Passaporte Digital.
              </p>
            </div>
            <SecondaryButton
              onClick={() => onNavigate("passaporte")}
              className="border-white/15 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
            >
              Ver passaporte <ArrowRight className="h-4 w-4" />
            </SecondaryButton>
          </div>
        </div>
        <div className="rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-[0_18px_55px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <TicketCheck className="h-6 w-6" />
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-extrabold text-slate-600">
              Em breve
            </span>
          </div>
          <p className="mt-5 text-3xl font-black tracking-tight text-slate-950">140</p>
          <p className="mt-1 text-sm font-semibold text-slate-500">pontos no passaporte</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-amber-400 to-orange-500" />
          </div>
        </div>
      </section>
    </motion.div>
  );
}

function MapScreen({ onOpenPlace }: { onOpenPlace: (place: Place) => void }) {
  const [selected, setSelected] = useState<Place>(places[0]!);
  const [category, setCategory] = useState<Category>("Todos");
  const [search, setSearch] = useState("");

  const visiblePlaces = useMemo(
    () =>
      places.filter((place) => {
        const categoryMatches = category === "Todos" || place.category === category;
        const searchMatches = place.name.toLowerCase().includes(search.toLowerCase());
        return categoryMatches && searchMatches;
      }),
    [category, search],
  );

  const markerPositions = [
    [26, 58],
    [47, 33],
    [62, 62],
    [78, 39],
    [36, 74],
    [58, 48],
  ];

  return (
    <motion.div
      key="map"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-5"
    >
      <SectionHeading
        eyebrow="Mapa inteligente"
        title="Explore Algodoal"
        description="Visualize praias, serviços e experiências. O mapa continua disponível no aparelho mesmo sem conexão."
      />

      <div className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200/80 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar no mapa" />
        <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
          {(["Todos", "Praias", "Comer", "Hospedar", "Passeios"] as Category[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20",
                  category === item
                    ? "bg-teal-700 text-white shadow-md shadow-teal-900/15"
                    : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800",
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>
        <IconButton label="Filtros avançados">
          <SlidersHorizontal className="h-5 w-5" />
        </IconButton>
      </div>

      <div className="grid min-h-[650px] overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)] lg:grid-cols-[1fr_360px]">
        <div className="relative min-h-[480px] overflow-hidden bg-teal-50">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(15,118,110,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(15,118,110,0.08)_1px,transparent_1px)] bg-[size:32px_32px]" />
          <div className="absolute left-[10%] top-[12%] h-[70%] w-[74%] rotate-[-8deg] rounded-[44%_56%_63%_37%/49%_33%_67%_51%] bg-gradient-to-br from-emerald-200 via-lime-200 to-amber-100 shadow-[inset_0_0_0_10px_rgba(255,255,255,0.4),0_35px_80px_rgba(15,118,110,0.18)]" />
          <div className="absolute left-[38%] top-[31%] h-[18%] w-[22%] rotate-12 rounded-[50%_44%_55%_45%] bg-cyan-100/80" />
          <div className="absolute right-[8%] top-[52%] h-[26%] w-[22%] rotate-12 rounded-[48%_52%_65%_35%] bg-gradient-to-br from-emerald-200 to-amber-100" />

          {visiblePlaces.map((place) => {
            const position = markerPositions[(place.id - 1) % markerPositions.length]!;
            const Icon = place.icon;
            const active = selected.id === place.id;
            return (
              <motion.button
                layout
                key={place.id}
                type="button"
                onClick={() => setSelected(place)}
                animate={{ scale: active ? 1.12 : 1 }}
                className={cn(
                  "absolute grid h-12 w-12 place-items-center rounded-2xl border-4 border-white shadow-xl transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/30",
                  active
                    ? "bg-teal-800 text-white"
                    : "bg-white text-teal-800 hover:bg-teal-50",
                )}
                style={{ left: `${position[0]}%`, top: `${position[1]}%` }}
                aria-label={place.name}
              >
                <Icon className="h-5 w-5" />
                {active && <span className="absolute -bottom-2 h-3 w-3 rotate-45 bg-teal-800" />}
              </motion.button>
            );
          })}

          <div className="absolute bottom-5 left-5 flex flex-col gap-2">
            <IconButton label="Localizar minha posição">
              <LocateFixed className="h-5 w-5" />
            </IconButton>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
              <button
                type="button"
                aria-label="Aumentar zoom"
                className="grid h-11 w-11 place-items-center text-slate-700 hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" />
              </button>
              <div className="mx-2 h-px bg-slate-200" />
              <button
                type="button"
                aria-label="Diminuir zoom"
                className="grid h-11 w-11 place-items-center text-slate-700 hover:bg-slate-50"
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="absolute right-5 top-5 rounded-full border border-white/70 bg-white/85 px-3 py-2 text-xs font-bold text-slate-600 shadow-lg backdrop-blur-md">
            {visiblePlaces.length} locais encontrados
          </div>
        </div>

        <aside className="border-t border-slate-200 bg-white p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
                Selecionado
              </p>
              <h3 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                {selected.name}
              </h3>
            </div>
            <IconButton label="Salvar local">
              <Heart className="h-4 w-4" />
            </IconButton>
          </div>
          <div className="mt-5">
            <PlaceVisual place={selected} large />
          </div>
          <p className="mt-5 text-sm leading-6 text-slate-500">{selected.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {selected.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-bold text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <MapPin className="h-4 w-4 text-teal-700" />
              <p className="mt-2 text-xs font-bold text-slate-500">Distância</p>
              <p className="mt-0.5 text-sm font-black text-slate-900">{selected.distance}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <Clock className="h-4 w-4 text-teal-700" />
              <p className="mt-2 text-xs font-bold text-slate-500">Situação</p>
              <p
                className={cn(
                  "mt-0.5 text-sm font-black",
                  selected.open ? "text-emerald-700" : "text-rose-700",
                )}
              >
                {selected.open ? "Aberto" : "Fechado"}
              </p>
            </div>
          </div>
          <PrimaryButton className="mt-5 w-full" onClick={() => onOpenPlace(selected)}>
            Ver detalhes completos <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
        </aside>
      </div>
    </motion.div>
  );
}

function DirectoryScreen({ onOpenPlace }: { onOpenPlace: (place: Place) => void }) {
  const [category, setCategory] = useState<Category>("Todos");
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const visiblePlaces = useMemo(
    () =>
      places.filter((place) => {
        const matchesCategory = category === "Todos" || place.category === category;
        const matchesSearch = `${place.name} ${place.description}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesCategory && matchesSearch && (!onlyOpen || place.open);
      }),
    [category, search, onlyOpen],
  );

  return (
    <motion.div
      key="directory"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <SectionHeading
        eyebrow="Diretório local"
        title="Descubra negócios e experiências"
        description="Informações organizadas para decidir rápido e valorizar quem vive e trabalha na ilha."
      />

      <div className="rounded-[1.75rem] border border-slate-200/80 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar por nome, serviço ou experiência"
          />
          <button
            type="button"
            onClick={() => setOnlyOpen((value) => !value)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-xs font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20",
              onlyOpen
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-teal-200 hover:text-teal-800",
            )}
          >
            <CheckCircle2 className="h-4 w-4" /> Somente abertos
          </button>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {(["Todos", "Praias", "Comer", "Hospedar", "Passeios"] as Category[]).map(
            (item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-extrabold transition",
                  category === item
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-teal-50 hover:text-teal-800",
                )}
              >
                {item}
              </button>
            ),
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-500">
          <strong className="text-slate-950">{visiblePlaces.length}</strong> resultados encontrados
        </p>
        <button
          type="button"
          className="inline-flex items-center gap-2 text-xs font-extrabold text-slate-600"
        >
          Mais relevantes <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      {visiblePlaces.length > 0 ? (
        <motion.div layout className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {visiblePlaces.map((place) => (
            <PlaceCard key={place.id} place={place} onOpen={onOpenPlace} />
          ))}
        </motion.div>
      ) : (
        <div className="grid min-h-80 place-items-center rounded-[2rem] border border-dashed border-slate-300 bg-white p-8 text-center">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-slate-100 text-slate-500">
              <Search className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-black text-slate-900">Nenhum resultado</h3>
            <p className="mt-2 text-sm text-slate-500">
              Tente mudar os filtros ou pesquisar outro termo.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function RideScreen({ offline }: { offline: boolean }) {
  const [step, setStep] = useState(1);
  const [passengers, setPassengers] = useState(2);
  const [origin, setOrigin] = useState("Vila de Algodoal");
  const [destination, setDestination] = useState("Praia da Princesa");

  const steps = [
    { number: 1, label: "Rota", icon: Route },
    { number: 2, label: "Passageiros", icon: Users },
    { number: 3, label: "Confirmar", icon: CheckCircle2 },
  ];

  return (
    <motion.div
      key="ride"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <SectionHeading
        eyebrow="Transporte local"
        title="Solicite uma carroça"
        description="Uma experiência simples para combinar origem, destino e número de passageiros."
      />

      {offline && (
        <div className="flex flex-col gap-4 rounded-[1.6rem] border border-amber-200 bg-amber-50 p-5 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <WifiOff className="h-5 w-5" />
            </div>
            <div>
              <p className="font-extrabold">Conexão necessária para enviar o pedido</p>
              <p className="mt-1 text-sm leading-6 text-amber-800/80">
                Você ainda pode consultar os pontos de encontro salvos no aparelho.
              </p>
            </div>
          </div>
          <SecondaryButton className="border-amber-200 bg-white text-amber-900 hover:border-amber-300 hover:text-amber-950">
            Ver pontos de encontro
          </SecondaryButton>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_390px]">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white p-5 shadow-[0_22px_65px_rgba(15,23,42,0.07)] sm:p-8">
          <div className="mb-8 flex items-center justify-between gap-2">
            {steps.map((item, index) => {
              const Icon = item.icon;
              const active = step === item.number;
              const complete = step > item.number;
              return (
                <React.Fragment key={item.number}>
                  <button
                    type="button"
                    onClick={() => setStep(item.number)}
                    className="group flex min-w-0 flex-col items-center gap-2"
                  >
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-2xl border text-sm font-black transition",
                        active
                          ? "border-teal-700 bg-teal-700 text-white shadow-lg shadow-teal-900/15"
                          : complete
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-400",
                      )}
                    >
                      {complete ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </span>
                    <span
                      className={cn(
                        "hidden text-[11px] font-extrabold sm:block",
                        active ? "text-teal-800" : "text-slate-400",
                      )}
                    >
                      {item.label}
                    </span>
                  </button>
                  {index < steps.length - 1 && (
                    <div className="h-0.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "h-full rounded-full bg-teal-600 transition-all duration-500",
                          step > item.number ? "w-full" : "w-0",
                        )}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="route"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-5"
              >
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">Defina sua rota</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Escolha pontos conhecidos para facilitar o encontro com o carroceiro.
                  </p>
                </div>
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
                    Origem
                  </span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                      <Navigation className="h-4 w-4" />
                    </span>
                    <select
                      value={origin}
                      onChange={(event) => setOrigin(event.target.value)}
                      className="h-[60px] w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-16 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10"
                    >
                      <option>Vila de Algodoal</option>
                      <option>Porto da Ilha</option>
                      <option>Praia do Farol</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-500">
                    Destino
                  </span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl bg-rose-100 text-rose-700">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <select
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      className="h-[60px] w-full appearance-none rounded-2xl border border-slate-200 bg-white pl-16 pr-12 text-sm font-bold text-slate-900 outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-500/10"
                    >
                      <option>Praia da Princesa</option>
                      <option>Praia do Farol</option>
                      <option>Trilha do Mangue</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  </div>
                </label>
                <PrimaryButton className="w-full sm:w-auto" onClick={() => setStep(2)}>
                  Continuar <ArrowRight className="h-4 w-4" />
                </PrimaryButton>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="passengers"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">Quantas pessoas?</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Informe o total para organizar a capacidade da carroça.
                  </p>
                </div>
                <div className="flex max-w-sm items-center justify-between rounded-[1.8rem] border border-slate-200 bg-slate-50 p-4">
                  <button
                    type="button"
                    onClick={() => setPassengers((value) => Math.max(1, value - 1))}
                    className="grid h-[52px] w-[52px] place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-teal-300 hover:text-teal-800"
                    aria-label="Diminuir passageiros"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="text-center">
                    <p className="text-4xl font-black tracking-tight text-slate-950">{passengers}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">
                      {passengers === 1 ? "passageiro" : "passageiros"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPassengers((value) => Math.min(8, value + 1))}
                    className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-900/15 hover:bg-teal-800"
                    aria-label="Aumentar passageiros"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <SecondaryButton onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </SecondaryButton>
                  <PrimaryButton onClick={() => setStep(3)}>
                    Revisar pedido <ArrowRight className="h-4 w-4" />
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                className="space-y-6"
              >
                <div>
                  <p className="text-xl font-black tracking-tight text-slate-950">Confirme os detalhes</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    O pedido será enviado apenas quando houver conexão com o servidor.
                  </p>
                </div>
                <div className="rounded-[1.7rem] border border-slate-200 bg-slate-50 p-5">
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                        Origem
                      </p>
                      <p className="mt-1.5 text-sm font-black text-slate-900">{origin}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                        Destino
                      </p>
                      <p className="mt-1.5 text-sm font-black text-slate-900">{destination}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-[0.15em] text-slate-400">
                        Passageiros
                      </p>
                      <p className="mt-1.5 text-sm font-black text-slate-900">{passengers}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <SecondaryButton onClick={() => setStep(2)}>
                    <ArrowLeft className="h-4 w-4" /> Voltar
                  </SecondaryButton>
                  <PrimaryButton disabled={offline} className="sm:min-w-48">
                    <Truck className="h-4 w-4" /> Solicitar carroça
                  </PrimaryButton>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <aside className="space-y-5">
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-teal-950 to-cyan-900 p-6 text-white shadow-xl shadow-slate-950/15">
            <div className="absolute inset-0 opacity-70">
              <IslandNetwork compact />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-teal-100 backdrop-blur-md">
                  Operação local
                </span>
                <BadgeCheck className="h-5 w-5 text-amber-300" />
              </div>
              <h3 className="mt-10 text-2xl font-black tracking-tight">
                Transporte tradicional, experiência digital.
              </h3>
              <p className="mt-3 text-sm leading-6 text-teal-50/70">
                O turista solicita; o carroceiro disponível aceita; a confirmação aparece no aplicativo.
              </p>
            </div>
          </div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-sm">
            <p className="text-sm font-black text-slate-950">Como funciona</p>
            <div className="mt-5 space-y-4">
              {[
                ["1", "Informe a rota", "Origem e destino claros"],
                ["2", "Aguarde o aceite", "Um prestador disponível responde"],
                ["3", "Encontre o carroceiro", "Acompanhe o ponto combinado"],
              ].map(([number, title, description]) => (
                <div key={number} className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-50 text-xs font-black text-teal-800">
                    {number}
                  </span>
                  <div>
                    <p className="text-sm font-extrabold text-slate-900">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </motion.div>
  );
}

function PassportScreen() {
  const achievements = [
    { icon: Waves, title: "Explorador das praias", progress: 80, color: "bg-cyan-500" },
    { icon: Leaf, title: "Guardião da ilha", progress: 55, color: "bg-emerald-500" },
    { icon: Camera, title: "Memórias de Algodoal", progress: 40, color: "bg-violet-500" },
  ];

  return (
    <motion.div
      key="passport"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="space-y-6"
    >
      <SectionHeading
        eyebrow="Sua jornada"
        title="Passaporte Digital"
        description="Check-ins, missões e conquistas reunidos em uma experiência clara, inclusive offline."
      />

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-slate-950 via-teal-950 to-emerald-950 p-7 text-white shadow-[0_30px_80px_rgba(15,23,42,0.2)] sm:p-10">
          <div className="absolute inset-0 opacity-60">
            <IslandNetwork />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-start">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-extrabold text-emerald-100 backdrop-blur-md">
                  <Sparkles className="h-4 w-4 text-amber-300" /> Jornada ativa
                </div>
                <h3 className="mt-5 text-3xl font-black tracking-tight sm:text-4xl">
                  Continue explorando.
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-6 text-emerald-50/70">
                  Cada visita e ação ambiental aproxima você de novas conquistas e recompensas.
                </p>
              </div>
              <div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full bg-[conic-gradient(#fbbf24_0_68%,rgba(255,255,255,0.14)_68%_100%)] p-2 shadow-2xl shadow-black/25">
                <div className="grid h-full w-full place-items-center rounded-full bg-teal-950/95 text-center backdrop-blur-md">
                  <div>
                    <p className="text-3xl font-black">68%</p>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-100/70">
                      concluído
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                ["8", "locais visitados", MapPin],
                ["3", "missões concluídas", Recycle],
                ["140", "pontos disponíveis", Star],
              ].map(([value, label, icon]) => {
                const Icon = icon as React.ElementType;
                return (
                  <div
                    key={String(label)}
                    className="rounded-[1.4rem] border border-white/10 bg-white/10 p-4 backdrop-blur-md"
                  >
                    <Icon className="h-4 w-4 text-amber-300" />
                    <p className="mt-3 text-2xl font-black">{String(value)}</p>
                    <p className="mt-0.5 text-xs font-semibold text-emerald-50/65">
                      {String(label)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-700">
              <RefreshCw className="h-5 w-5" />
            </div>
            <span className="rounded-full border border-amber-200 bg-white/70 px-3 py-1.5 text-[11px] font-extrabold text-amber-800">
              Aguardando rede
            </span>
          </div>
          <p className="mt-6 text-4xl font-black tracking-tight text-amber-950">+20</p>
          <p className="mt-1 text-sm font-bold text-amber-900/70">pontos pendentes</p>
          <p className="mt-4 text-sm leading-6 text-amber-900/65">
            Uma missão foi salva no aparelho e será enviada quando a conexão voltar.
          </p>
          <div className="mt-6 rounded-2xl bg-white/70 p-4">
            <div className="flex items-center justify-between text-xs font-bold text-amber-900">
              <span>Limpeza da praia</span>
              <span>+20</span>
            </div>
            <p className="mt-1 text-[11px] text-amber-800/60">Registrada hoje às 14:28</p>
          </div>
        </aside>
      </div>

      <section>
        <SectionHeading
          eyebrow="Conquistas"
          title="Seu progresso na ilha"
          description="Metas objetivas e transparentes, sem esconder o que ainda depende de validação."
        />
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {achievements.map((achievement) => {
            const Icon = achievement.icon;
            return (
              <article
                key={achievement.title}
                className="rounded-[1.8rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_45px_rgba(15,23,42,0.05)]"
              >
                <div className="flex items-center justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="text-sm font-black text-slate-400">{achievement.progress}%</span>
                </div>
                <h3 className="mt-5 font-extrabold text-slate-950">{achievement.title}</h3>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${achievement.progress}%` }}
                    transition={{ duration: 0.7, delay: 0.15 }}
                    className={cn("h-full rounded-full", achievement.color)}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </motion.div>
  );
}

function PlaceDetails({ place, onClose }: { place: Place; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={spring}
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-[2rem] bg-white p-3 shadow-2xl sm:rounded-[2rem]"
      >
        <div className="relative">
          <PlaceVisual place={place} large />
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar detalhes"
            className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-2xl border border-white/25 bg-slate-950/35 text-white backdrop-blur-md transition hover:bg-slate-950/55 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/30"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-teal-700">
            {place.category}
          </p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-950">
            {place.name}
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {place.rating.toFixed(1)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-4 w-4" /> {place.distance}
            </span>
            <span className={place.open ? "text-emerald-700" : "text-rose-700"}>
              {place.open ? "Aberto agora" : "Fechado"}
            </span>
          </div>
          <p className="mt-6 text-sm leading-7 text-slate-600">{place.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {place.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-3">
            <PrimaryButton>
              <Navigation className="h-4 w-4" /> Ver rota
            </PrimaryButton>
            <SecondaryButton>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </SecondaryButton>
            <SecondaryButton>
              <Phone className="h-4 w-4" /> Ligar
            </SecondaryButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("turista@example.com");
  const [password, setPassword] = useState("algodoal-teste");

  return (
    <motion.div
      className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/65 p-3 backdrop-blur-md sm:p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={spring}
        className="grid max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] bg-white shadow-2xl lg:grid-cols-2"
      >
        <div className="relative hidden min-h-[620px] overflow-hidden bg-gradient-to-br from-teal-950 via-slate-950 to-cyan-900 p-10 text-white lg:block">
          <IslandNetwork />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-slate-950/55" />
          <div className="relative z-10 flex h-full flex-col justify-between">
            <Brand />
            <div>
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl border border-white/15 bg-white/10 text-amber-300 backdrop-blur-md">
                <Navigation className="h-6 w-6" />
              </div>
              <h2 className="max-w-md text-4xl font-black leading-tight tracking-[-0.04em]">
                Sua jornada começa antes mesmo de chegar.
              </h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-teal-50/70">
                Salve o mapa, acompanhe seu passaporte e conecte-se com serviços locais.
              </p>
            </div>
          </div>
        </div>

        <div className="relative flex min-h-[620px] flex-col justify-center p-6 sm:p-10 lg:p-12">
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar login"
            className="absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <div className="mt-10 lg:mt-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-teal-700">
              Área do visitante
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Bem-vindo de volta
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Entre para sincronizar seu passaporte e suas conquistas.
            </p>
          </div>

          <form
            className="mt-8 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              onSuccess();
            }}
          >
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold text-slate-700">E-mail</span>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-extrabold text-slate-700">Senha</span>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-[52px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 pr-13 text-sm font-medium text-slate-900 outline-none transition focus:border-teal-400 focus:bg-white focus:ring-4 focus:ring-teal-500/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-700"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>
            <div className="flex items-center justify-between gap-4 text-xs">
              <label className="inline-flex items-center gap-2 font-semibold text-slate-600">
                <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 text-teal-700" />
                Manter conectado
              </label>
              <button type="button" className="font-extrabold text-teal-700 hover:text-teal-900">
                Esqueci a senha
              </button>
            </div>
            <PrimaryButton type="submit" className="w-full">
              Entrar na plataforma <ArrowRight className="h-4 w-4" />
            </PrimaryButton>
          </form>

          <div className="my-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
            <div className="h-px flex-1 bg-slate-200" /> ou <div className="h-px flex-1 bg-slate-200" />
          </div>
          <SecondaryButton onClick={onClose} className="w-full">
            Continuar como visitante
          </SecondaryButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function AlgodoalDigitalV2() {
  const [activeTab, setActiveTab] = useState<Tab>("inicio");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const [details, setDetails] = useState<Place | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const navigate = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="algodoal-v2-root min-h-screen bg-stone-50 text-slate-900 selection:bg-teal-200 selection:text-teal-950">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[268px] border-r border-slate-200/80 bg-white/90 p-5 backdrop-blur-xl xl:flex xl:flex-col">
        <Brand />
        <nav className="mt-10 space-y-1.5" aria-label="Navegação principal">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20",
                  active
                    ? "bg-teal-950 text-white shadow-lg shadow-teal-950/15"
                    : "text-slate-500 hover:bg-teal-50 hover:text-teal-900",
                )}
              >
                <span
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-xl transition",
                    active
                      ? "bg-white/10 text-amber-300"
                      : "bg-slate-100 text-slate-500 group-hover:bg-white",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                {item.label}
                {active && <ChevronRight className="ml-auto h-4 w-4 text-white/50" />}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto space-y-4">
          <div className="rounded-[1.6rem] bg-gradient-to-br from-teal-950 via-cyan-950 to-slate-950 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-amber-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-extrabold">
                OFFLINE
              </span>
            </div>
            <p className="mt-4 text-sm font-black">Conteúdo salvo</p>
            <p className="mt-1 text-[11px] leading-5 text-teal-50/65">
              Mapa e diretório prontos para usar sem internet.
            </p>
          </div>
          <p className="px-2 text-[10px] font-semibold leading-5 text-slate-400">
            Algodoal Digital · MVP 2026
            <br /> Dados demonstrativos
          </p>
        </div>
      </aside>

      <div className="xl:pl-[268px]">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-stone-50/90 backdrop-blur-xl">
          <div className="mx-auto flex h-20 max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menu"
              className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-700 xl:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden min-w-0 flex-1 md:block">
              <SearchField value="" onChange={() => undefined} placeholder="Buscar em Algodoal" />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StatusPill offline={offline} onClick={() => setOffline((value) => !value)} />
              <IconButton label="Notificações">
                <Bell className="h-5 w-5" />
              </IconButton>
              <button
                type="button"
                onClick={() => (loggedIn ? undefined : setLoginOpen(true))}
                className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 pr-3 text-left shadow-sm transition hover:border-teal-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-500/20"
              >
                <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-teal-600 to-cyan-700 text-white">
                  {loggedIn ? <UserRound className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                </span>
                <span className="hidden sm:block">
                  <span className="block text-[10px] font-bold text-slate-400">
                    {loggedIn ? "Olá" : "Visitante"}
                  </span>
                  <span className="block text-xs font-extrabold text-slate-800">
                    {loggedIn ? "Usuário" : "Entrar"}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1540px] px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 xl:pb-12">
          {offline && (
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
              <WifiOff className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-extrabold">Você está usando dados salvos</p>
                <p className="mt-1 text-xs leading-5 text-amber-800/75">
                  Última atualização hoje às 14:32. Algumas ações exigem conexão.
                </p>
              </div>
            </div>
          )}
          <AnimatePresence mode="wait">
            {activeTab === "inicio" && (
              <HomeScreen onNavigate={navigate} onOpenPlace={setDetails} />
            )}
            {activeTab === "mapa" && <MapScreen onOpenPlace={setDetails} />}
            {activeTab === "diretorio" && <DirectoryScreen onOpenPlace={setDetails} />}
            {activeTab === "carroca" && <RideScreen offline={offline} />}
            {activeTab === "passaporte" && <PassportScreen />}
          </AnimatePresence>
        </main>
      </div>

      <nav
        className="fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-[1.6rem] border border-white/70 bg-slate-950/95 p-1.5 shadow-2xl shadow-slate-950/30 backdrop-blur-xl xl:hidden"
        aria-label="Navegação móvel"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.id)}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[9px] font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                active ? "bg-white text-teal-950" : "text-white/55 hover:text-white",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-teal-700")} />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            className="fixed inset-0 z-[70] bg-slate-950/50 backdrop-blur-sm xl:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setMobileMenuOpen(false);
            }}
          >
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={spring}
              className="h-full w-[300px] max-w-[86vw] bg-white p-5 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <Brand />
                <IconButton label="Fechar menu" onClick={() => setMobileMenuOpen(false)}>
                  <X className="h-5 w-5" />
                </IconButton>
              </div>
              <nav className="mt-8 space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const active = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigate(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-extrabold",
                        active ? "bg-teal-950 text-white" : "text-slate-600 hover:bg-slate-50",
                      )}
                    >
                      <Icon className="h-5 w-5" /> {item.label}
                    </button>
                  );
                })}
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {details && <PlaceDetails place={details} onClose={() => setDetails(null)} />}
      </AnimatePresence>
      <AnimatePresence>
        {loginOpen && (
          <LoginModal
            onClose={() => setLoginOpen(false)}
            onSuccess={() => {
              setLoggedIn(true);
              setLoginOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
