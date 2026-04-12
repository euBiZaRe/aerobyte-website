const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const products = [
  {
    id: 'cinema',
    name: 'AeroByte Cinema',
    description: 'The ultimate destination for all your media needs. Stream movies, TV shows, music, manga, and live sports in a single unified interface.',
    icon: 'fas fa-film',
    type: 'solution',
    version: 'v1.2',
    features: [
      { icon: 'fas fa-tv', title: 'Live IPTV', description: 'Access thousands of global channels with zero-buffer streaming technology.' },
      { icon: 'fas fa-film', title: 'Movie Library', description: 'Stream the latest releases in 4K HDR with multi-language subtitle support.' },
      { icon: 'fas fa-music', title: 'Hi-Fi Music', description: 'Lossless audio streaming with integrated playlist management.' }
    ],
    downloadLinks: {
      windows: 'https://github.com/example/cinema/releases/latest/windows.exe',
      android: 'https://github.com/example/cinema/releases/latest/android.apk',
      ios: 'https://apps.apple.com/app/aerobyte-cinema'
    },
    status: 'active'
  },
  {
    id: 'rl-bot-trainer',
    name: 'RL Bot Trainer',
    description: 'Professional-grade reinforcement learning training for Rocket League. Powered by our proprietary GigaLearn infrastructure.',
    icon: 'fas fa-robot',
    type: 'product',
    version: 'v1.4.2',
    features: [
      { icon: '🚀', title: 'Unlimited VRAM Support', description: 'Bypass hardware limitations by utilizing cloud-synced VRAM optimization. Train larger models without OOM errors.' },
      { icon: '🧠', title: 'GigaLearn Integration', description: 'Native integration with GigaLearn infrastructure for unparalleled reinforcement learning convergence rates.' },
      { icon: '👁️', title: 'AeroByte Visual Simulator', description: 'Launch the dedicated visualizer window for 3D stadium telemetry. Compare models head-to-head with the new Bot Comparator.' }
    ],
    downloadLinks: {
      windows: 'https://github.com/x84kjbyf2c-stack/AeroByte-Studio/releases/download/v1.2/AeroByte_Launcher.exe'
    },
    status: 'active'
  },
  {
    id: 'among-us-mod-menu',
    name: 'Among Us Mod Menu',
    description: 'The definitive companion for Among Us. Glassmorphic UI, runtime discovery patching, and complete cosmetic access.',
    icon: 'fas fa-ghost',
    type: 'product',
    version: 'v1.0.2',
    features: [
      { icon: '⚡', title: 'AeroSpeed Hack', description: 'Precision movement speed control with 0.1x increments (1.0x to 10.0x) for perfect stealth or hyper-speed.' },
      { icon: '👻', title: 'Quantum No-Clip', description: 'Walk through walls and obstacles with zero collision detection. Navigate the map with absolute freedom.' },
      { icon: '🕳️', title: 'Surgical Venting', description: 'Spoof \'Impostor\' status to interact with vents as a Crewmate. Perfect for high-level tactical repositioning.' }
    ],
    downloadLinks: {
      windows: 'https://github.com/euBiZaRe/AeroByte-Among-Us/releases/download/v1.0.0/Steam.V1.0.zip'
    },
    status: 'active'
  }
];

async function seed() {
  for (const product of products) {
    await db.collection('products').doc(product.id).set(product);
    console.log(`Seeded: ${product.name}`);
  }
  process.exit();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
