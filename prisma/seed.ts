import { PrismaClient, Role, OrgType, QuestionType, QuestionDifficulty } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'demo-academy' },
    update: {},
    create: {
      name: 'Demo Academy',
      slug: 'demo-academy',
      type: OrgType.UNIVERSITY,
      settings: {
        grading: { system: 'PERCENTAGE', defaultPassMark: 50 },
      },
    },
  });

  const passwordHash = await bcrypt.hash('Password123!', 10);

  // 2. Create Users
  const systemAdmin = await prisma.user.upsert({
    where: { email: 'admin@examina.com' },
    update: {},
    create: {
      email: 'admin@examina.com',
      passwordHash,
      firstName: 'System',
      lastName: 'Admin',
      role: Role.SYSTEM_ADMIN,
    },
  });

  const orgAdmin = await prisma.user.upsert({
    where: { email: 'org@demo.com' },
    update: {},
    create: {
      email: 'org@demo.com',
      passwordHash,
      firstName: 'Org',
      lastName: 'Admin',
      role: Role.ORG_ADMIN,
      organizationId: org.id,
    },
  });

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      email: 'teacher@demo.com',
      passwordHash,
      firstName: 'John',
      lastName: 'Teacher',
      role: Role.TEACHER,
      organizationId: org.id,
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: {
      email: 'student@demo.com',
      passwordHash,
      firstName: 'Jane',
      lastName: 'Student',
      role: Role.STUDENT,
      organizationId: org.id,
    },
  });

  // 3. Create Questions
  const question = await prisma.question.create({
    data: {
      organizationId: org.id,
      createdById: teacher.id,
      subject: 'Mathematics',
      topic: 'Algebra',
      difficulty: QuestionDifficulty.MEDIUM,
      versions: {
        create: {
          versionNumber: 1,
          type: QuestionType.MCQ,
          text: 'What is 5 + 5?',
          points: 5,
          createdById: teacher.id,
          options: {
            create: [
              { text: '10', isCorrect: true, orderIndex: 0 },
              { text: '15', isCorrect: false, orderIndex: 1 },
              { text: '20', isCorrect: false, orderIndex: 2 },
            ],
          },
        },
      },
    },
  });

  // Link current version
  const versions = await prisma.questionVersion.findMany({ where: { questionId: question.id } });
  await prisma.question.update({
    where: { id: question.id },
    data: { currentVersionId: versions[0].id },
  });

  // 4. Create Exam
  const exam = await prisma.exam.create({
    data: {
      title: 'Midterm Math Exam',
      organizationId: org.id,
      createdById: teacher.id,
      durationMinutes: 60,
      passPercentage: 50,
      isPublished: true,
      examQuestions: {
        create: {
          questionId: question.id,
          versionId: versions[0].id,
          orderIndex: 1,
        },
      },
    },
  });

  console.log('✅ Seed finished successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
