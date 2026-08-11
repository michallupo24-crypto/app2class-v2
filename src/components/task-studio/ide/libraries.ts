import { LibraryOption } from './types';

export const AVAILABLE_LIBRARIES: LibraryOption[] = [
  {
    id: 'p5js',
    name: 'p5.js',
    category: 'graphics',
    description: 'גרפיקה אינטראקטיבית, אנימציות וסימולציות פיזיקליות בדפדפן',
    scripts: ['https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js'],
    sampleSnippet: `function setup() {
  createCanvas(400, 400);
  background(240);
}

function draw() {
  fill(100, 150, 255, 50);
  ellipse(mouseX, mouseY, 30, 30);
}`
  },
  {
    id: 'chartjs',
    name: 'Chart.js',
    category: 'charts',
    description: 'גרפים ותרשימים אינטראקטיביים (עמודות, עוגה, קווים)',
    scripts: ['https://cdn.jsdelivr.net/npm/chart.js'],
    sampleSnippet: `const ctx = document.getElementById('myChart');
new Chart(ctx, {
  type: 'bar',
  data: {
    labels: ['א', 'ב', 'ג', 'ד', 'ה'],
    datasets: [{ label: 'ציונים', data: [85, 92, 78, 95, 88] }]
  }
});`
  },
  {
    id: 'threejs',
    name: 'Three.js',
    category: '3d',
    description: 'גרפיקת תלת-ממד (3D WebGL) מתקדמת',
    scripts: ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'],
    sampleSnippet: `const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(300, 300);
document.body.appendChild(renderer.domElement);`
  },
  {
    id: 'tailwindcss',
    name: 'Tailwind CSS',
    category: 'styling',
    description: 'עיצוב מודרני מבוסס Tailwind Utility Classes',
    scripts: ['https://cdn.tailwindcss.com'],
    sampleSnippet: `<button class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition">
  לחץ עלי
</button>`
  },
  {
    id: 'katex',
    name: 'KaTeX Math',
    category: 'math',
    description: 'רינדור נוסחאות מתמטיות באיכות גבוהה (LaTeX)',
    scripts: ['https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js'],
    styles: ['https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css'],
    sampleSnippet: `katex.render("f(x) = \\\\int_{-\\\\infty}^{\\\\infty} e^{-x^2} dx", document.getElementById('math'));`
  },
  {
    id: 'tonejs',
    name: 'Tone.js',
    category: 'audio',
    description: 'סינתזת סאונד ומוזיקה אינטראקטיבית בדפדפן',
    scripts: ['https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'],
    sampleSnippet: `const synth = new Tone.Synth().toDestination();
synth.triggerAttackRelease("C4", "8n");`
  },
  {
    id: 'phaser',
    name: 'Phaser 3',
    category: 'game',
    description: 'מנוע משחקים דו-ממדי (2D Game Engine) מקיף',
    scripts: ['https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js'],
    sampleSnippet: `const config = { type: Phaser.AUTO, width: 400, height: 300, parent: 'game-container' };
const game = new Phaser.Game(config);`
  },
  {
    id: 'confetti',
    name: 'Canvas Confetti',
    category: 'utility',
    description: 'אפקט חגיגת קונפטי לקבלת ציון 100 או הצלחה במשימה',
    scripts: ['https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js'],
    sampleSnippet: `confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });`
  }
];
