import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        internshipTerms: {
          where: { status: 'CONFIRMED' },
          orderBy: { startDate: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findByCode(code: string) {
    return this.prisma.user.findUnique({
      where: { code },
    });
  }

  async getCurrentSchedule(userId: string) {
    const today = new Date();
    return this.prisma.internshipTerm.findFirst({
      where: {
        userId,
        status: 'CONFIRMED',
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });
  }
}
