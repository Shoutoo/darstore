const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// MLBB Diamonds catalog
const mlDiamonds = [
  { namaItem: '5 (5+0) Diamonds', harga: 1855, nominal: '5' },
  { namaItem: '10 (9+1) Diamonds', harga: 3596, nominal: '10' },
  { namaItem: '12 (11+1) Diamonds', harga: 4073, nominal: '12' },
  { namaItem: '14 (13+1) Diamonds', harga: 4728, nominal: '14' },
  { namaItem: '19 (17+2) Diamonds', harga: 6465, nominal: '19' },
  { namaItem: '21 (19+2) Diamonds', harga: 7120, nominal: '21' },
  { namaItem: '22 (20+2) Diamonds', harga: 7448, nominal: '22' },
  { namaItem: '28 (25+3) Diamonds', harga: 9412, nominal: '28' },
  { namaItem: '36 (32+4) Diamonds', harga: 12132, nominal: '36' },
  { namaItem: '38 (34+4) Diamonds', harga: 12495, nominal: '38' },
  { namaItem: '39 (35+4) Diamonds', harga: 12726, nominal: '39' },
  { namaItem: '44 (40+4) Diamonds', harga: 13874, nominal: '44' },
  { namaItem: '44 (40+4) Diamonds', harga: 13874, nominal: '44' },
  { namaItem: '45 (41+4) Diamonds', harga: 14175, nominal: '45' },
  { namaItem: '48 (42+6) Diamonds', harga: 15081, nominal: '48' },
  { namaItem: '54 (48+6) Diamonds', harga: 17092, nominal: '54' },
  { namaItem: '56 (50+6) Diamonds', harga: 17695, nominal: '56' },
  { namaItem: '59 (53+6) Diamonds', harga: 18601, nominal: '59' },
  { namaItem: '64 (58+6) Diamonds', harga: 20110, nominal: '64' },
  { namaItem: '70 (63+7) Diamonds', harga: 21921, nominal: '70' },
  { namaItem: '71 (64+7) Diamonds', harga: 22223, nominal: '71' },
  { namaItem: '72 (65+7) Diamonds', harga: 22525, nominal: '72' },
  { namaItem: '74 (67+7) Diamonds', harga: 23128, nominal: '74' },
  { namaItem: '75 (68+7) Diamonds', harga: 23430, nominal: '75' },
  { namaItem: '79 (70+9) Diamonds', harga: 24637, nominal: '79' },
  { namaItem: '80 (73+7) Diamonds', harga: 24939, nominal: '80' },
  { namaItem: '85 (77+8) Diamonds', harga: 26648, nominal: '85' },
  { namaItem: '86 (78+8) Diamonds', harga: 26950, nominal: '86' },
  { namaItem: '88 (80+8) Diamonds', harga: 27547, nominal: '88' },
  { namaItem: '92 (84+8) Diamonds', harga: 28740, nominal: '92' },
  { namaItem: '100 (90+10) Diamonds', harga: 31126, nominal: '100' },
  { namaItem: '110 (99+11) Diamonds', harga: 34108, nominal: '110' },
  { namaItem: '113 (102+11) Diamonds', harga: 35003, nominal: '113' },
  { namaItem: '118 (107+11) Diamonds', harga: 36494, nominal: '118' },
  { namaItem: '129 (117+12) Diamonds', harga: 39775, nominal: '129' },
  { namaItem: '144 (130+14) Diamonds', harga: 44449, nominal: '144' },
  { namaItem: '148 (134+14) Diamonds', harga: 45642, nominal: '148' },
  { namaItem: '170 (154+16) Diamonds', harga: 52203, nominal: '170' },
  { namaItem: '176 (160+16) Diamonds', harga: 53976, nominal: '176' },
  { namaItem: '182 (165+17) Diamonds', harga: 55740, nominal: '182' },
  { namaItem: '222 (201+21) Diamonds', harga: 67498, nominal: '222' },
  { namaItem: '229 (207+22) Diamonds', harga: 69555, nominal: '229' },
  { namaItem: '240 (217+23) Diamonds', harga: 72789, nominal: '240' },
  { namaItem: '241 (218+23) Diamonds', harga: 73083, nominal: '241' },
  { namaItem: '257 (231+26) Diamonds', harga: 78086, nominal: '257' },
  { namaItem: '278 (251+27) Diamonds', harga: 84218, nominal: '278' },
  { namaItem: '294 (267+27) Diamonds', harga: 88890, nominal: '294' },
  { namaItem: '296 (256+40) Diamonds', harga: 89474, nominal: '296' },
  { namaItem: '301 (261+40) Diamonds', harga: 90934, nominal: '301' },
  { namaItem: '313 (282+31) Diamonds', harga: 94438, nominal: '313' },
  { namaItem: '324 (291+33) Diamonds', harga: 97650, nominal: '324' },
  { namaItem: '345 (301+44) Diamonds', harga: 103782, nominal: '345' },
  { namaItem: '355 (308+47) Diamonds', harga: 106702, nominal: '355' },
  { namaItem: '371 (324+47) Diamonds', harga: 111374, nominal: '371' },
  { namaItem: '374 (328+46) Diamonds', harga: 112250, nominal: '374' },
  { namaItem: '385 (342+43) Diamonds', harga: 115462, nominal: '385' },
  { namaItem: '384 (348+36) Diamonds', harga: 115170, nominal: '384' },
  { namaItem: '408 (367+41) Diamonds', harga: 122178, nominal: '408' },
  { namaItem: '426 (373+53) Diamonds', harga: 127734, nominal: '426' },
  { namaItem: '437 (384+53) Diamonds', harga: 130946, nominal: '437' },
  { namaItem: '459 (406+53) Diamonds', harga: 137370, nominal: '459' },
  { namaItem: '512 (461+51) Diamonds', harga: 152846, nominal: '512' },
  { namaItem: '518 (467+51) Diamonds', harga: 154581, nominal: '518' },
  { namaItem: '523 (471+52) Diamonds', harga: 156019, nominal: '523' },
  { namaItem: '568 (503+65) Diamonds', harga: 168963, nominal: '568' },
  { namaItem: '601 (535+66) Diamonds', harga: 178455, nominal: '601' },
  { namaItem: '712 (634+78) Diamonds', harga: 210761, nominal: '712' },
  { namaItem: '717 (639+78) Diamonds', harga: 212180, nominal: '717' },
  { namaItem: '719 (639+80) Diamonds', harga: 212748, nominal: '719' },
  { namaItem: '723 (647+76) Diamonds', harga: 213883, nominal: '723' },
  { namaItem: '750 (668+82) Diamonds', harga: 221547, nominal: '750' },
  { namaItem: '762 (682+80) Diamonds', harga: 224953, nominal: '762' },
  { namaItem: '790 (703+87) Diamonds', harga: 232901, nominal: '790' },
  { namaItem: '808 (720+88) Diamonds', harga: 238010, nominal: '808' },
  { namaItem: '875 (774+101) Diamonds', harga: 257027, nominal: '875' },
  { namaItem: '963 (857+106) Diamonds', harga: 282006, nominal: '963' },
  { namaItem: '969 (863+106) Diamonds', harga: 283709, nominal: '969' },
  { namaItem: '977 (867+110) Diamonds', harga: 285979, nominal: '977' },
  { namaItem: '1050 (933+117) Diamonds', harga: 307000, nominal: '1050' },
  { namaItem: '1067 (953+114) Diamonds', harga: 311797, nominal: '1067' },
  { namaItem: '1136 (1006+130) Diamonds', harga: 331269, nominal: '1136' },
  { namaItem: '1138 (1014+124) Diamonds', harga: 331834, nominal: '1138' },
  { namaItem: '1159 (1019+140) Diamonds', harga: 337760, nominal: '1159' },
  { namaItem: '1164 (1036+128) Diamonds', harga: 339171, nominal: '1164' },
  { namaItem: '1220 (1085+135) Diamonds', harga: 354974, nominal: '1220' },
  { namaItem: '1229 (1079+150) Diamonds', harga: 357514, nominal: '1229' },
  { namaItem: '1232 (1085+147) Diamonds', harga: 358360, nominal: '1232' },
  { namaItem: '1368 (1220+148) Diamonds', harga: 396739, nominal: '1368' },
  { namaItem: '1398 (1248+150) Diamonds', harga: 405205, nominal: '1398' },
  { namaItem: '1412 (1256+156) Diamonds', harga: 409156, nominal: '1412' },
  { namaItem: '1443 (1277+166) Diamonds', harga: 417823, nominal: '1443' },
  { namaItem: '1453 (1285+168) Diamonds', harga: 420619, nominal: '1453' },
  { namaItem: '1507 (1335+172) Diamonds', harga: 435717, nominal: '1507' },
  { namaItem: '1672 (1486+186) Diamonds', harga: 481849, nominal: '1672' },
  { namaItem: '1704 (1509+195) Diamonds', harga: 490796, nominal: '1704' },
  { namaItem: '1708 (1508+200) Diamonds', harga: 491915, nominal: '1708' },
  { namaItem: '1835 (1630+205) Diamonds', harga: 527423, nominal: '1835' },
  { namaItem: '1919 (1708+211) Diamonds', harga: 550908, nominal: '1919' },
  { namaItem: '2046 (1791+255) Diamonds', harga: 586416, nominal: '2046' },
  { namaItem: '2180 (1942+238) Diamonds', harga: 623881, nominal: '2180' },
  { namaItem: '2195 (1975+220) Diamonds', harga: 628075, nominal: '2195' },
  { namaItem: '2280 (2017+263) Diamonds', harga: 651670, nominal: '2280' },
  { namaItem: '2388 (2123+265) Diamonds', harga: 681650, nominal: '2388' },
  { namaItem: '2392 (2123+269) Diamonds', harga: 682760, nominal: '2392' },
  { namaItem: '2528 (2244+284) Diamonds', harga: 720512, nominal: '2528' },
  { namaItem: '2570 (2283+287) Diamonds', harga: 732171, nominal: '2570' },
  { namaItem: '2800 (2481+319) Diamonds', harga: 796017, nominal: '2800' },
  { namaItem: '2860 (2539+321) Diamonds', harga: 812672, nominal: '2860' },
  { namaItem: '2904 (2499+405) Diamonds', harga: 824886, nominal: '2904' },
  { namaItem: '2977 (2565+412) Diamonds', harga: 845150, nominal: '2977' },
  { namaItem: '3146 (2734+412) Diamonds', harga: 892063, nominal: '3146' },
  { namaItem: '3453 (2993+460) Diamonds', harga: 977282, nominal: '3453' },
  { namaItem: '3481 (3010+471) Diamonds', harga: 985055, nominal: '3481' },
  { namaItem: '3683 (3202+481) Diamonds', harga: 1041128, nominal: '3683' },
  { namaItem: '3738 (3247+491) Diamonds', harga: 1056316, nominal: '3738' },
  { namaItem: '4028 (3493+535) Diamonds', harga: 1136356, nominal: '4028' },
  { namaItem: '4036 (3432+604) Diamonds', harga: 1138564, nominal: '4036' },
  { namaItem: '4404 (3762+642) Diamonds', harga: 1240132, nominal: '4404' },
  { namaItem: '4830 (4052+778) Diamonds', harga: 1357708, nominal: '4830' },
  { namaItem: '4994 (4367+627) Diamonds', harga: 1402972, nominal: '4994' },
  { namaItem: '4958 (4252+706) Diamonds', harga: 1393036, nominal: '4958' },
  { namaItem: '5052 (4269+783) Diamonds', harga: 1418980, nominal: '5052' },
  { namaItem: '5266 (4608+658) Diamonds', harga: 1478044, nominal: '5266' },
  { namaItem: '5568 (4869+699) Diamonds', harga: 1561362, nominal: '5568' },
  { namaItem: '6001 (5219+782) Diamonds', harga: 1680460, nominal: '6001' },
  { namaItem: '6088 (5124+964) Diamonds', harga: 1704390, nominal: '6088' },
  { namaItem: '6257 (5274+983) Diamonds', harga: 1750874, nominal: '6257' },
  { namaItem: '6849 (5723+1126) Diamonds', harga: 1913707, nominal: '6849' },
  { namaItem: '7188 (6019+1179) Diamonds', harga: 2006950, nominal: '7188' },
  { namaItem: '7210 (6044+1166) Diamonds', harga: 2013001, nominal: '7210' },
  { namaItem: '7668 (6442+1226) Diamonds', harga: 2138976, nominal: '7668' },
  { namaItem: '7753 (6497+1256) Diamonds', harga: 2162356, nominal: '7753' },
  { namaItem: '8040 (6832+1208) Diamonds', harga: 2241296, nominal: '8040' },
  { namaItem: '8302 (7009+1293) Diamonds', harga: 2313360, nominal: '8302' },
  { namaItem: '8865 (7425+1440) Diamonds', harga: 2468216, nominal: '8865' },
  { namaItem: '9302 (7826+1476) Diamonds', harga: 2588394, nominal: '9302' },
  { namaItem: '9660 (8006+1654) Diamonds', harga: 2686338, nominal: '9660' },
  { namaItem: '10440 (8924+1516) Diamonds', harga: 2899734, nominal: '10440' },
  { namaItem: '11670 (9714+1956) Diamonds', harga: 3236243, nominal: '11670' },
  { namaItem: '12380 (10438+1942) Diamonds', harga: 3430489, nominal: '12380' },
  { namaItem: '12965 (10869+2096) Diamonds', harga: 3590536, nominal: '12965' },
  { namaItem: '13660 (11410+2250) Diamonds', harga: 3780678, nominal: '13660' },
  { namaItem: '14488 (11964+2524) Diamonds', harga: 4007206, nominal: '14488' },
  { namaItem: '14814 (12290+2524) Diamonds', harga: 4096395, nominal: '14814' },
  { namaItem: '16390 (13604+2816) Diamonds', harga: 4527565, nominal: '16390' },
  { namaItem: '16599 (13773+2796) Diamonds', harga: 4584744, nominal: '16599' },
  { namaItem: '18510 (15451+3059) Diamonds', harga: 5107565, nominal: '18510' },
  { namaItem: '19320 (16012+3308) Diamonds', harga: 5329169, nominal: '19320' },
  { namaItem: '20136 (16708+3428) Diamonds', harga: 5552414, nominal: '20136' },
  { namaItem: '21338 (17719+3619) Diamonds', harga: 5881263, nominal: '21338' },
  { namaItem: '24339 (20019+4320) Diamonds', harga: 6702292, nominal: '24339' },
  { namaItem: '28900 (24016+4882) Diamonds', harga: 7950113, nominal: '28900' }
];

// Valorant Points catalog (Region Indonesia)
const valoPoints = [
  { namaItem: '475 Points', harga: 54000, nominal: '475' },
  { namaItem: '950 Points', harga: 107100, nominal: '950' },
  { namaItem: '1000 Points', harga: 111100, nominal: '1000' },
  { namaItem: '1475 Points', harga: 164200, nominal: '1475' },
  { namaItem: '2000 Points', harga: 215700, nominal: '2000' },
  { namaItem: '2050 Points', harga: 218800, nominal: '2050' },
  { namaItem: '2525 Points', harga: 265023, nominal: '2525' },
  { namaItem: '3050 Points', harga: 316413, nominal: '3050' },
  { namaItem: '3650 Points', harga: 374800, nominal: '3650' },
  { namaItem: '4100 Points', harga: 418576, nominal: '4100' },
  { namaItem: '4125 Points', harga: 421008, nominal: '4125' },
  { namaItem: '4650 Points', harga: 472079, nominal: '4650' },
  { namaItem: '5350 Points', harga: 540175, nominal: '5350' },
  { namaItem: '5700 Points', harga: 573987, nominal: '5700' },
  { namaItem: '5825 Points', harga: 586063, nominal: '5825' },
  { namaItem: '6350 Points', harga: 636781, nominal: '6350' },
  { namaItem: '7300 Points', harga: 728557, nominal: '7300' },
  { namaItem: '7400 Points', harga: 738218, nominal: '7400' },
  { namaItem: '8400 Points', harga: 834824, nominal: '8400' },
  { namaItem: '8990 Points', harga: 891822, nominal: '8990' },
  { namaItem: '9000 Points', harga: 892788, nominal: '9000' },
  { namaItem: '10000 Points', harga: 989394, nominal: '10000' },
  { namaItem: '10700 Points', harga: 1057018, nominal: '10700' },
  { namaItem: '11000 Points', harga: 1086000, nominal: '11000' },
  { namaItem: '11475 Points', harga: 1131363, nominal: '11475' },
  { namaItem: '12000 Points', harga: 1181500, nominal: '12000' },
  { namaItem: '13050 Points', harga: 1281775, nominal: '13050' },
  { namaItem: '14650 Points', harga: 1434575, nominal: '14650' },
  { namaItem: '16700 Points', harga: 1630350, nominal: '16700' },
  { namaItem: '18400 Points', harga: 1792700, nominal: '18400' },
  { namaItem: '20000 Points', harga: 1945500, nominal: '20000' },
  { namaItem: '22000 Points', harga: 2136500, nominal: '22000' }
];

async function main() {
  console.log('Seeding products via Prisma...');

  const allProducts = [
    ...mlDiamonds.map(d => ({
      game: 'mlbb',
      namaItem: d.namaItem,
      nominal: d.nominal,
      harga: d.harga,
      isActive: true
    })),
    ...valoPoints.map(v => ({
      game: 'valorant',
      namaItem: v.namaItem,
      nominal: v.nominal,
      harga: v.harga,
      isActive: true
    }))
  ];

  await prisma.product.deleteMany();
  console.log('Cleared existing products table.');

  const result = await prisma.product.createMany({
    data: allProducts,
    skipDuplicates: true
  });

  console.log(`Successfully seeded ${result.count} products to database!`);

  // Seed default admin user
  const bcrypt = require('bcryptjs');
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'admin@darstore.com' },
    update: { passwordHash: adminPasswordHash, nama: "Admin Dar'sstore", role: 'admin' },
    create: {
      nama: "Admin Dar'sstore",
      email: 'admin@darstore.com',
      whatsapp: '081234567899',
      passwordHash: adminPasswordHash,
      points: 100,
      role: 'admin'
    }
  });
  console.log('Default Admin user ready: admin@darstore.com / admin123 (role: admin)');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
