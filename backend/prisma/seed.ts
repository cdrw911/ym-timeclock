import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Create system admin
  const systemAdmin = await prisma.user.upsert({
    where: { email: 'system@timeclock.internal' },
    update: {},
    create: {
      code: 'SYSTEM',
      name: 'System Administrator',
      email: 'system@timeclock.internal',
      role: 'SYSTEM_ADMIN',
      isActive: true,
    },
  });
  console.log('✅ System admin created');

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      code: 'ADMIN',
      name: '管理員',
      email: 'admin@example.com',
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log('✅ Admin user created');

  // Create test interns
  const intern1 = await prisma.user.upsert({
    where: { email: 'i86@example.com' },
    update: {},
    create: {
      code: 'I86',
      name: '測試實習生一',
      email: 'i86@example.com',
      role: 'INTERN',
      isActive: true,
      discordId: 'test_discord_id_1',
    },
  });

  const intern2 = await prisma.user.upsert({
    where: { email: 'i87@example.com' },
    update: {},
    create: {
      code: 'I87',
      name: '測試實習生二',
      email: 'i87@example.com',
      role: 'INTERN',
      isActive: true,
      discordId: 'test_discord_id_2',
    },
  });
  console.log('✅ Test interns created');

  // Create internship terms
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 3, 0);

  await prisma.internshipTerm.create({
    data: {
      userId: intern1.id,
      startDate,
      endDate,
      status: 'CONFIRMED',
      baseSchedule: {
        monday: { start: '08:30', end: '18:00' },
        tuesday: { start: '08:30', end: '18:00' },
        wednesday: { start: '10:00', end: '18:00' }, // 週三課程時間不同
        thursday: { start: '08:30', end: '18:00' },
        friday: { start: '08:30', end: '18:00' },
      },
    },
  });

  await prisma.internshipTerm.create({
    data: {
      userId: intern2.id,
      startDate,
      endDate,
      status: 'CONFIRMED',
      baseSchedule: {
        monday: { start: '08:30', end: '18:00' },
        tuesday: { start: '08:30', end: '18:00' },
        wednesday: { start: '08:30', end: '18:00' },
        thursday: { start: '08:30', end: '18:00' },
        friday: { start: '08:30', end: '18:00' },
      },
    },
  });
  console.log('✅ Internship terms created');

  // Create score records for current month
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  await prisma.scoreRecord.create({
    data: {
      userId: intern1.id,
      yearMonth,
      baseScore: 100,
      totalDeduction: 0,
      bonusPoints: 0,
      finalScore: 100,
      status: 'CALCULATING',
    },
  });

  await prisma.scoreRecord.create({
    data: {
      userId: intern2.id,
      yearMonth,
      baseScore: 100,
      totalDeduction: 0,
      bonusPoints: 0,
      finalScore: 100,
      status: 'CALCULATING',
    },
  });
  console.log('✅ Score records created');

  console.log('🎉 Seed completed successfully!');
  console.log('\n📝 Test Accounts:');
  console.log('Admin: admin@example.com');
  console.log('Intern 1: I86 (i86@example.com)');
  console.log('Intern 2: I87 (i87@example.com)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
