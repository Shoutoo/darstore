export const PAYMENT_GROUPS = [
  {
    id: 'virtual_account',
    title: 'Virtual Account',
    status: 'Tersedia',
    badge: 'TERSEDIA',
    badgeClass: 'badge-available',
    description: 'Pembayaran melalui transfer bank dengan verifikasi otomatis Midtrans.',
    minPrice: 1000,
    isDemo: false,
    methods: [
      {
        id: 'bni_va',
        name: 'Bank BNI (VA)',
        bank: 'BNI',
        fee: 1000,
        image: '/assets/payments/va_bni.png',
        channel: 'bni_va',
        description: 'Bayar via BNI Mobile Banking, ATM, atau SMS Banking',
        isDemo: false
      },
      {
        id: 'bri_va',
        name: 'Bank BRI (BRIVA)',
        bank: 'BRI',
        fee: 1000,
        image: '/assets/payments/va_briva.png',
        channel: 'bri_va',
        description: 'Bayar via BRImo, ATM BRI, atau Agen BRILink',
        isDemo: false
      },
      {
        id: 'mandiri_va',
        name: 'Bank Mandiri (Livin / VA)',
        bank: 'Mandiri',
        fee: 1000,
        image: '/assets/payments/va_mandiri.png',
        channel: 'echannel',
        description: 'Bayar via Livin by Mandiri, ATM, atau Internet Banking',
        isDemo: false
      },
      {
        id: 'cimb_va',
        name: 'CIMB Niaga (OCTO / VA)',
        bank: 'CIMB',
        fee: 1000,
        image: '/assets/payments/va_cimb.png',
        channel: 'cimb_va',
        description: 'Bayar via OCTO Mobile, OCTO Clicks, atau ATM CIMB',
        isDemo: false
      },
      {
        id: 'permata_va',
        name: 'PermataBank (VA)',
        bank: 'Permata',
        fee: 1000,
        image: '/assets/payments/va_permata.png',
        channel: 'permata_va',
        description: 'Bayar via PermataMobile X, PermataNet, atau ATM',
        isDemo: false
      }
    ]
  },
  {
    id: 'qris_demo',
    title: 'QRIS (Demo)',
    status: 'Belum Aktif',
    badge: 'BELUM AKTIF',
    badgeClass: 'badge-demo',
    description: 'Pratinjau fitur QRIS. Belum dapat digunakan untuk pembayaran.',
    minPrice: 1000,
    isDemo: true,
    methods: [
      {
        id: 'qris_demo_method',
        name: 'QRIS Instant (Demo)',
        fee: 0,
        image: '/assets/payments/qris_demo_watermark.svg',
        channel: 'qris_demo',
        isDemo: true,
        badge: 'DEMO',
        description: 'Pratinjau antarmuka QRIS. Tidak memproses pembayaran nyata.'
      }
    ]
  }
];
