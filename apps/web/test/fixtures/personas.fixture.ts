export const mockPersonas = {
  personas: [
    {
      id: 'persona_1',
      name: 'Sales Coach',
      orgId: 'org_123',
      traits: {
        role: 'coach',
        level: 'expert',
        personality: 'encouraging',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'persona_2',
      name: 'Product Manager',
      orgId: 'org_123',
      traits: {
        role: 'manager',
        level: 'senior',
        personality: 'analytical',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'persona_3',
      name: 'Customer Success',
      orgId: 'org_123',
      traits: {
        role: 'support',
        level: 'expert',
        personality: 'empathetic',
      },
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
  ],
  total: 3,
}

export const mockPersonasEmpty = {
  personas: [],
  total: 0,
}
