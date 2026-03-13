# 완성 예제 - 전체 동작 코드

완전한 NestJS 구현 패턴을 보여주는 실전 예시 모음입니다.

## 목차

- [컨트롤러 (Controller)](#controller)
- [DTO(Data Transfer Object)](#dto)
- [서비스 (Service)](#service)
- [리포지토리 (Repository)](#repository)
- [모듈 (Module)](#module)
- [End-to-End 요청 흐름](#e2e-request-flow)

---

## 컨트롤러 (Controller)

```typescript
// src/users/users.controller.ts
import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard) // 모든 유저 라우트에 인증 적용
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get()
  async findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
```

---

## DTO(Data Transfer Object)

```typescript
// src/users/dto/user.dto.ts
import { IsEmail, IsString, IsInt, Min, Max, IsOptional } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsInt()
  @Min(18)
  age: number;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;
  
  @IsOptional()
  @IsInt()
  age?: number;
}
```

---

## 서비스 (Service)

```typescript
// src/users/users.service.ts
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto) {
    const existingUser = await this.usersRepository.findByEmail(dto.email);
    if (existingUser) {
      throw new ConflictException('Email already in use');
    }
    return this.usersRepository.create(dto);
  }

  async findAll() {
    return this.usersRepository.findAll();
  }

  async findOne(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.usersRepository.findByEmail(dto.email);
      if (emailTaken) {
        throw new ConflictException('Email already in use');
      }
    }
    return this.usersRepository.update(id, dto);
  }

  async remove(id: string) {
    const existing = await this.usersRepository.findById(id);
    if (!existing) {
      throw new NotFoundException('User not found');
    }
    return this.usersRepository.remove(id);
  }
}
```

---

## 리포지토리 (Repository)

```typescript
// src/users/users.repository.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserDto) {
    return this.prisma.user.create({ data });
  }

  async findAll() {
    return this.prisma.user.findMany({ where: { isActive: true } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, data: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
```

---

## 모듈 (Module)

```typescript
// src/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
// Prisma Module is assumed to be globally available or imported here

@Module({
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // 다른 컴포넌트에서 쓰기 위해 내보내기
})
export class UsersModule {}
```

---

## End-to-End 요청 흐름

```text
POST /users
  ↓
Middleware 단계 (Express 기반 로깅 또는 커스텀 모듈)
  ↓
JwtAuthGuard 단계 (토큰이 유효한지 확인)
  ↓
Interceptor 단계 (로깅, 리퀘스트 ID 매핑)
  ↓
ValidationPipe 단계 (CreateUserDto를 바탕으로 Zod가 했던 검증을 수행, 실패시 반려)
  ↓
Controller.create(dto)
  ↓
UsersService.create(dto) : 비즈니스 예외(ConflictException) 발생 여부 체크
  ↓
UsersRepository.create(dto) : Prisma 스키마 저장
  ↓
Controller/Interceptor 거쳐 Response 변환 -> 클라이언트로 반환
```

---

**Related Files:**
- [SKILL.md](SKILL.md)
- [routing-and-controllers.md](routing-and-controllers.md)
- [services-and-repositories.md](services-and-repositories.md)
- [validation-patterns.md](validation-patterns.md)
