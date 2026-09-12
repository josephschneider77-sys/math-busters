export type Point = { x: number; y: number };

const COLORS = [
  "#ffbe0b",
  "#ff8a3d",
  "#ef6f4f",
  "#4cc9f0",
  "#2a9d8f",
  "#c77dff",
  "#fff4e0",
  "#ffe08a",
];

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function cellCenter(_wrap: HTMLElement, cell: HTMLElement): Point {
  const box = cell.getBoundingClientRect();
  return {
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
  };
}

export function playBurst(
  host: HTMLElement,
  origins: Point[],
  mode: "explode" | "implode",
): Promise<void> {
  const sparks: HTMLElement[] = [];
  const duration = 900;

  for (const origin of origins) {
    for (let i = 0; i < 36; i++) {
      const spark = document.createElement("span");
      const angle = (Math.PI * 2 * i) / 36 + rand(-0.15, 0.15);
      const dist = rand(90, 220);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const spin = rand(-280, 280);
      const star = i % 4 === 0;
      spark.className = `spark${star ? " spark-star" : ""}`;
      spark.style.left = `${origin.x}px`;
      spark.style.top = `${origin.y}px`;
      spark.style.background = COLORS[i % COLORS.length];
      host.appendChild(spark);

      const start = `translate(${mode === "implode" ? dx : 0}px, ${mode === "implode" ? dy : 0}px) scale(${mode === "implode" ? 0.2 : 1}) rotate(${mode === "implode" ? spin : 0}deg)`;
      const end = `translate(${mode === "explode" ? dx : 0}px, ${mode === "explode" ? dy : 0}px) scale(${mode === "explode" ? 0.2 : 1}) rotate(${mode === "explode" ? spin : 0}deg)`;
      spark.animate(
        [
          { transform: start, opacity: mode === "implode" ? 0 : 1 },
          { transform: end, opacity: mode === "explode" ? 0 : 1 },
        ],
        { duration: rand(640, 900), easing: mode === "explode" ? "ease-out" : "ease-in", fill: "forwards" },
      );
      sparks.push(spark);
    }
  }

  return new Promise((resolve) => {
    window.setTimeout(() => {
      for (const spark of sparks) spark.remove();
      resolve();
    }, duration);
  });
}
