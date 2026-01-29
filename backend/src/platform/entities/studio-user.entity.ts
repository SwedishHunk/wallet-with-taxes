import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { Studio } from './studio.entity';
import { GamePlayer } from './game-player.entity';

export enum StudioUserRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

@Entity()
@Unique(['studio', 'email'])
export class StudioUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Studio, (studio) => studio.studioUsers, { onDelete: 'CASCADE' })
  studio: Studio;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: StudioUserRole, default: StudioUserRole.MEMBER })
  role: StudioUserRole;

  @Column({ type: 'json', default: {} })
  accessPoints: Record<string, boolean>;

  @OneToMany(() => GamePlayer, (gamePlayer) => gamePlayer.studioUser)
  gamePlayers: GamePlayer[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
