import { StudiosService } from "./studios.service";
import { Request } from "express";
export declare class StudiosController {
    private studiosService;
    constructor(studiosService: StudiosService);
    getMembers(req: Request, studioId: string): Promise<any[]>;
    createMember(req: Request, studioId: string, dto: {
        email: string;
        password?: string;
        role?: string;
        permissions?: string[];
    }): Promise<any>;
}
