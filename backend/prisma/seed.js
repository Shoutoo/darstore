const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// MLBB Diamonds catalog
const mlDiamonds = [
  { namaItem: '5 (5+0) Diamonds', harga: 1694, nominal: '5' },
  { namaItem: '10 (9+1) Diamonds', harga: 3387, nominal: '10' },
  { namaItem: '12 (11+1) Diamonds', harga: 3993, nominal: '12' },
  { namaItem: '14 (13+1) Diamonds', harga: 4381, nominal: '14' },
  { namaItem: '19 (17+2) Diamonds', harga: 6208, nominal: '19' },
  { namaItem: '21 (19+2) Diamonds', harga: 6773, nominal: '21' },
  { namaItem: '22 (20+2) Diamonds', harga: 7379, nominal: '22' },
  { namaItem: '28 (25+3) Diamonds', harga: 9103, nominal: '28' },
  { namaItem: '36 (32+4) Diamonds', harga: 10159, nominal: '36' },
  { namaItem: '38 (34+4) Diamonds', harga: 11372, nominal: '38' },
  { namaItem: '39 (35+4) Diamonds', harga: 11878, nominal: '39' },
  { namaItem: '44 (40+4) Diamonds', harga: 12161, nominal: '44' },
  { namaItem: '44 (40+4) Diamonds', harga: 13818, nominal: '44' },
  { namaItem: '45 (41+4) Diamonds', harga: 14804, nominal: '45' },
  { namaItem: '48 (42+6) Diamonds', harga: 15364, nominal: '48' },
  { namaItem: '54 (48+6) Diamonds', harga: 17303, nominal: '54' },
  { namaItem: '56 (50+6) Diamonds', harga: 17609, nominal: '56' },
  { namaItem: '59 (53+6) Diamonds', harga: 18921, nominal: '59' },
  { namaItem: '64 (58+6) Diamonds', harga: 19714, nominal: '64' },
  { namaItem: '70 (63+7) Diamonds', harga: 21698, nominal: '70' },
  { namaItem: '71 (64+7) Diamonds', harga: 22013, nominal: '71' },
  { namaItem: '72 (65+7) Diamonds', harga: 22225, nominal: '72' },
  { namaItem: '74 (67+7) Diamonds', harga: 23198, nominal: '74' },
  { namaItem: '75 (68+7) Diamonds', harga: 23816, nominal: '75' },
  { namaItem: '79 (70+9) Diamonds', harga: 24343, nominal: '79' },
  { namaItem: '80 (73+7) Diamonds', harga: 25057, nominal: '80' },
  { namaItem: '85 (77+8) Diamonds', harga: 25678, nominal: '85' },
  { namaItem: '86 (78+8) Diamonds', harga: 27232, nominal: '86' },
  { namaItem: '88 (80+8) Diamonds', harga: 28435, nominal: '88' },
  { namaItem: '92 (84+8) Diamonds', harga: 28832, nominal: '92' },
  { namaItem: '100 (90+10) Diamonds', harga: 30295, nominal: '100' },
  { namaItem: '110 (99+11) Diamonds', harga: 33616, nominal: '110' },
  { namaItem: '113 (102+11) Diamonds', harga: 34765, nominal: '113' },
  { namaItem: '118 (107+11) Diamonds', harga: 36229, nominal: '118' },
  { namaItem: '129 (117+12) Diamonds', harga: 38901, nominal: '129' },
  { namaItem: '144 (130+14) Diamonds', harga: 43600, nominal: '144' },
  { namaItem: '148 (134+14) Diamonds', harga: 45862, nominal: '148' },
  { namaItem: '170 (154+16) Diamonds', harga: 51061, nominal: '170' },
  { namaItem: '176 (160+16) Diamonds', harga: 54464, nominal: '176' },
  { namaItem: '182 (165+17) Diamonds', harga: 55374, nominal: '182' },
  { namaItem: '222 (201+21) Diamonds', harga: 68250, nominal: '222' },
  { namaItem: '229 (207+22) Diamonds', harga: 69353, nominal: '229' },
  { namaItem: '240 (217+23) Diamonds', harga: 71862, nominal: '240' },
  { namaItem: '241 (218+23) Diamonds', harga: 73615, nominal: '241' },
  { namaItem: '257 (231+26) Diamonds', harga: 77388, nominal: '257' },
  { namaItem: '278 (251+27) Diamonds', harga: 83215, nominal: '278' },
  { namaItem: '294 (267+27) Diamonds', harga: 86268, nominal: '294' },
  { namaItem: '296 (256+40) Diamonds', harga: 88768, nominal: '296' },
  { namaItem: '301 (261+40) Diamonds', harga: 90195, nominal: '301' },
  { namaItem: '313 (282+31) Diamonds', harga: 93332, nominal: '313' },
  { namaItem: '324 (291+33) Diamonds', harga: 97565, nominal: '324' },
  { namaItem: '345 (301+44) Diamonds', harga: 103400, nominal: '345' },
  { namaItem: '355 (308+47) Diamonds', harga: 106398, nominal: '355' },
  { namaItem: '371 (324+47) Diamonds', harga: 111704, nominal: '371' },
  { namaItem: '374 (328+46) Diamonds', harga: 112678, nominal: '374' },
  { namaItem: '385 (342+43) Diamonds', harga: 114275, nominal: '385' },
  { namaItem: '384 (348+36) Diamonds', harga: 115827, nominal: '384' },
  { namaItem: '408 (367+41) Diamonds', harga: 123361, nominal: '408' },
  { namaItem: '426 (373+53) Diamonds', harga: 127496, nominal: '426' },
  { namaItem: '437 (384+53) Diamonds', harga: 129772, nominal: '437' },
  { namaItem: '459 (406+53) Diamonds', harga: 137537, nominal: '459' },
  { namaItem: '512 (461+51) Diamonds', harga: 155518, nominal: '512' },
  { namaItem: '518 (467+51) Diamonds', harga: 158256, nominal: '518' },
  { namaItem: '523 (471+52) Diamonds', harga: 159837, nominal: '523' },
  { namaItem: '568 (503+65) Diamonds', harga: 165838, nominal: '568' },
  { namaItem: '601 (535+66) Diamonds', harga: 176740, nominal: '601' },
  { namaItem: '712 (634+78) Diamonds', harga: 205608, nominal: '712' },
  { namaItem: '717 (639+78) Diamonds', harga: 211328, nominal: '717' },
  { namaItem: '719 (639+80) Diamonds', harga: 211328, nominal: '719' },
  { namaItem: '723 (647+76) Diamonds', harga: 212988, nominal: '723' },
  { namaItem: '750 (668+82) Diamonds', harga: 221433, nominal: '750' },
  { namaItem: '762 (682+80) Diamonds', harga: 228559, nominal: '762' },
  { namaItem: '790 (703+87) Diamonds', harga: 236104, nominal: '790' },
  { namaItem: '808 (720+88) Diamonds', harga: 239135, nominal: '808' },
  { namaItem: '875 (774+101) Diamonds', harga: 254253, nominal: '875' },
  { namaItem: '963 (857+106) Diamonds', harga: 285341, nominal: '963' },
  { namaItem: '969 (863+106) Diamonds', harga: 285884, nominal: '969' },
  { namaItem: '977 (867+110) Diamonds', harga: 288325, nominal: '977' },
  { namaItem: '1050 (933+117) Diamonds', harga: 308086, nominal: '1050' },
  { namaItem: '1067 (953+114) Diamonds', harga: 318650, nominal: '1067' },
  { namaItem: '1136 (1006+130) Diamonds', harga: 332121, nominal: '1136' },
  { namaItem: '1138 (1014+124) Diamonds', harga: 334731, nominal: '1138' },
  { namaItem: '1159 (1019+140) Diamonds', harga: 340196, nominal: '1159' },
  { namaItem: '1164 (1036+128) Diamonds', harga: 341856, nominal: '1164' },
  { namaItem: '1220 (1085+135) Diamonds', harga: 358354, nominal: '1220' },
  { namaItem: '1229 (1079+150) Diamonds', harga: 360216, nominal: '1229' },
  { namaItem: '1232 (1085+147) Diamonds', harga: 361324, nominal: '1232' },
  { namaItem: '1368 (1220+148) Diamonds', harga: 404372, nominal: '1368' },
  { namaItem: '1398 (1248+150) Diamonds', harga: 410678, nominal: '1398' },
  { namaItem: '1412 (1256+156) Diamonds', harga: 417878, nominal: '1412' },
  { namaItem: '1443 (1277+166) Diamonds', harga: 429306, nominal: '1443' },
  { namaItem: '1453 (1285+168) Diamonds', harga: 430117, nominal: '1453' },
  { namaItem: '1507 (1335+172) Diamonds', harga: 440519, nominal: '1507' },
  { namaItem: '1672 (1486+186) Diamonds', harga: 494348, nominal: '1672' },
  { namaItem: '1704 (1509+195) Diamonds', harga: 504060, nominal: '1704' },
  { namaItem: '1708 (1508+200) Diamonds', harga: 509371, nominal: '1708' },
  { namaItem: '1835 (1630+205) Diamonds', harga: 535616, nominal: '1835' },
  { namaItem: '1919 (1708+211) Diamonds', harga: 564425, nominal: '1919' },
  { namaItem: '2046 (1791+255) Diamonds', harga: 584840, nominal: '2046' },
  { namaItem: '2180 (1942+238) Diamonds', harga: 634706, nominal: '2180' },
  { namaItem: '2195 (1975+220) Diamonds', harga: 670788, nominal: '2195' },
  { namaItem: '2280 (2017+263) Diamonds', harga: 675996, nominal: '2280' },
  { namaItem: '2388 (2123+265) Diamonds', harga: 697000, nominal: '2388' },
  { namaItem: '2392 (2123+269) Diamonds', harga: 701025, nominal: '2392' },
  { namaItem: '2528 (2244+284) Diamonds', harga: 733132, nominal: '2528' },
  { namaItem: '2570 (2283+287) Diamonds', harga: 733809, nominal: '2570' },
  { namaItem: '2800 (2481+319) Diamonds', harga: 822282, nominal: '2800' },
  { namaItem: '2860 (2539+321) Diamonds', harga: 828151, nominal: '2860' },
  { namaItem: '2904 (2499+405) Diamonds', harga: 854232, nominal: '2904' },
  { namaItem: '2977 (2565+412) Diamonds', harga: 856695, nominal: '2977' },
  { namaItem: '3146 (2734+412) Diamonds', harga: 903194, nominal: '3146' },
  { namaItem: '3453 (2993+460) Diamonds', harga: 1004212, nominal: '3453' },
  { namaItem: '3481 (3010+471) Diamonds', harga: 1045293, nominal: '3481' },
  { namaItem: '3683 (3202+481) Diamonds', harga: 1098368, nominal: '3683' },
  { namaItem: '3738 (3247+491) Diamonds', harga: 1083764, nominal: '3738' },
  { namaItem: '4028 (3493+535) Diamonds', harga: 1128849, nominal: '4028' },
  { namaItem: '4036 (3432+604) Diamonds', harga: 1149753, nominal: '4036' },
  { namaItem: '4404 (3762+642) Diamonds', harga: 1282695, nominal: '4404' },
  { namaItem: '4830 (4052+778) Diamonds', harga: 1325655, nominal: '4830' },
  { namaItem: '4994 (4367+627) Diamonds', harga: 1390273, nominal: '4994' },
  { namaItem: '4958 (4252+706) Diamonds', harga: 1394660, nominal: '4958' },
  { namaItem: '5052 (4269+783) Diamonds', harga: 1423174, nominal: '5052' },
  { namaItem: '5266 (4608+658) Diamonds', harga: 1495278, nominal: '5266' },
  { namaItem: '5568 (4869+699) Diamonds', harga: 1549769, nominal: '5568' },
  { namaItem: '6001 (5219+782) Diamonds', harga: 1672885, nominal: '6001' },
  { namaItem: '6088 (5124+964) Diamonds', harga: 1689274, nominal: '6088' },
  { namaItem: '6257 (5274+983) Diamonds', harga: 1751451, nominal: '6257' },
  { namaItem: '6849 (5723+1126) Diamonds', harga: 1902431, nominal: '6849' },
  { namaItem: '7188 (6019+1179) Diamonds', harga: 2008829, nominal: '7188' },
  { namaItem: '7210 (6044+1166) Diamonds', harga: 2045659, nominal: '7210' },
  { namaItem: '7668 (6442+1226) Diamonds', harga: 2144630, nominal: '7668' },
  { namaItem: '7753 (6497+1256) Diamonds', harga: 2163106, nominal: '7753' },
  { namaItem: '8040 (6832+1208) Diamonds', harga: 2237880, nominal: '8040' },
  { namaItem: '8302 (7009+1293) Diamonds', harga: 2325816, nominal: '8302' },
  { namaItem: '8865 (7425+1440) Diamonds', harga: 2475648, nominal: '8865' },
  { namaItem: '9302 (7826+1476) Diamonds', harga: 2605584, nominal: '9302' },
  { namaItem: '9660 (8006+1654) Diamonds', harga: 2688415, nominal: '9660' },
  { namaItem: '10440 (8924+1516) Diamonds', harga: 2959321, nominal: '10440' },
  { namaItem: '11670 (9714+1956) Diamonds', harga: 3231647, nominal: '11670' },
  { namaItem: '12380 (10438+1942) Diamonds', harga: 3439296, nominal: '12380' },
  { namaItem: '12965 (10869+2096) Diamonds', harga: 3610274, nominal: '12965' },
  { namaItem: '13660 (11410+2250) Diamonds', harga: 3804860, nominal: '13660' },
  { namaItem: '14488 (11964+2524) Diamonds', harga: 4005390, nominal: '14488' },
  { namaItem: '14814 (12290+2524) Diamonds', harga: 4105390, nominal: '14814' },
  { namaItem: '16390 (13604+2816) Diamonds', harga: 4515356, nominal: '16390' },
  { namaItem: '16599 (13773+2796) Diamonds', harga: 4560862, nominal: '16599' },
  { namaItem: '18510 (15451+3059) Diamonds', harga: 5134078, nominal: '18510' },
  { namaItem: '19320 (16012+3308) Diamonds', harga: 5316981, nominal: '19320' },
  { namaItem: '20136 (16708+3428) Diamonds', harga: 5571780, nominal: '20136' },
  { namaItem: '21338 (17719+3619) Diamonds', harga: 5890077, nominal: '21338' },
  { namaItem: '24339 (20019+4320) Diamonds', harga: 6698075, nominal: '24339' },
  { namaItem: '28900 (24016+4882) Diamonds', harga: 7979326, nominal: '28900' }
];

// Valorant Points catalog (Region Indonesia)
const valoPoints = [
  { namaItem: '475 Points', harga: 54259, nominal: '475' },
  { namaItem: '950 Points', harga: 108518, nominal: '950' },
  { namaItem: '1000 Points', harga: 108518, nominal: '1000' },
  { namaItem: '1475 Points', harga: 162777, nominal: '1475' },
  { namaItem: '2050 Points', harga: 217034, nominal: '2050' },
  { namaItem: '2000 Points', harga: 217035, nominal: '2000' },
  { namaItem: '2525 Points', harga: 271293, nominal: '2525' },
  { namaItem: '3050 Points', harga: 325552, nominal: '3050' },
  { namaItem: '3650 Points', harga: 376902, nominal: '3650' },
  { namaItem: '4125 Points', harga: 431161, nominal: '4125' },
  { namaItem: '4100 Points', harga: 434068, nominal: '4100' },
  { namaItem: '4650 Points', harga: 485420, nominal: '4650' },
  { namaItem: '5350 Points', harga: 541615, nominal: '5350' },
  { namaItem: '5700 Points', harga: 593936, nominal: '5700' },
  { namaItem: '5825 Points', harga: 595873, nominal: '5825' },
  { namaItem: '6350 Points', harga: 650132, nominal: '6350' },
  { namaItem: '7300 Points', harga: 753804, nominal: '7300' },
  { namaItem: '7400 Points', harga: 758649, nominal: '7400' },
  { namaItem: '8400 Points', harga: 867166, nominal: '8400' },
  { namaItem: '9000 Points', harga: 918516, nominal: '9000' },
  { namaItem: '8990 Points', harga: 918516, nominal: '8990' },
  { namaItem: '10000 Points', harga: 1027034, nominal: '10000' },
  { namaItem: '11000 Points', harga: 1064820, nominal: '11000' },
  { namaItem: '10700 Points', harga: 1083229, nominal: '10700' },
  { namaItem: '11475 Points', harga: 1119079, nominal: '11475' },
  { namaItem: '12000 Points', harga: 1173338, nominal: '12000' },
  { namaItem: '13050 Points', harga: 1281854, nominal: '13050' },
  { namaItem: '14650 Points', harga: 1441722, nominal: '14650' },
  { namaItem: '16700 Points', harga: 1658756, nominal: '16700' },
  { namaItem: '18400 Points', harga: 1823468, nominal: '18400' },
  { namaItem: '20000 Points', harga: 1983336, nominal: '20000' },
  { namaItem: '22000 Points', harga: 2129640, nominal: '22000' }
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
    update: { passwordHash: adminPasswordHash, nama: "Admin Dar'sstore" },
    create: {
      nama: "Admin Dar'sstore",
      email: 'admin@darstore.com',
      whatsapp: '081234567899',
      passwordHash: adminPasswordHash,
      points: 100
    }
  });
  console.log('Default Admin user ready: admin@darstore.com / admin123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
