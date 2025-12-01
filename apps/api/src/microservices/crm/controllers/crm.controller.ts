import { Controller, Get, Post, Body, Param } from '@nestjs/common';

@Controller('crm')
export class CrmController {
    @Get()
    getAll() {
        // Logic to get all CRM records
        return { message: 'Get all CRM records' };
    }

    @Get(':id')
    getOne(@Param('id') id: string) {
        // Logic to get a single CRM record by id
        return { message: `Get CRM record with id ${id}` };
    }

    @Post()
    create(@Body() createDto: any) {
        // Logic to create a new CRM record
        return { message: 'Create CRM record', data: createDto };
    }
}