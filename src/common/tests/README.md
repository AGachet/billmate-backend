# Infrastructure de Tests Factorized - Guide d'utilisation

Ce document explique comment utiliser la nouvelle infrastructure de tests factorized pour rendre vos tests plus maintenables, lisibles et cohérents.

## 🎯 Objectifs

- **Normalisation** : Standardiser la façon d'écrire les tests dans tous les modules
- **Réutilisabilité** : Factoriser le code commun pour éviter la duplication
- **Maintenabilité** : Faciliter la mise à jour et la maintenance des tests
- **Lisibilité** : Améliorer la compréhension des tests pour les développeurs

## 📁 Structure

```
src/common/tests/
├── unit/
│   ├── base/
│   │   └── service-test-base.ts       # Classe de base pour les tests unitaires
│   ├── builders/
│   │   └── test-data-builders.ts      # Builders pour créer des données de test
│   ├── mocks/
│   │   ├── service-mocks.ts           # Mocks des services communs
│   │   └── test-data.ts               # Données de test statiques (legacy)
│   ├── utils/
│   │   ├── test-utils.ts              # Utilitaires de base
│   │   └── advanced-test-utils.ts     # Utilitaires avancés
│   └── types/
├── e2e/
│   ├── base/
│   │   └── e2e-test-base.ts           # Classe de base pour les tests E2E
│   └── utils/
│       ├── setup-test-user.ts         # Utilitaires pour les utilisateurs de test
│       └── setup-test-*.ts            # Autres utilitaires de setup
```

## 🔧 Tests Unitaires

### Utilisation de la classe de base `ServiceTestBase`

```typescript
import { ServiceTestBase } from '@common/tests/unit/base/service-test-base'
import { TestDataFactory } from '@common/tests/unit/builders/test-data-builders'
import { TestAssertions, MockManager } from '@common/tests/unit/utils/advanced-test-utils'

class MyServiceTest extends ServiceTestBase<MyService> {
  private mockManager = new MockManager()

  protected getServiceClass() {
    return MyService
  }

  protected getProviders(): Provider[] {
    return [
      { provide: PrismaService, useValue: mockPrismaService },
      { provide: Logger, useValue: mockLogger }
    ]
  }

  protected async customSetup(): Promise<void> {
    // Configuration spécifique à votre service
    this.mockManager.createMock('mySpecificMock')
  }

  testMyMethod(): void {
    describe('myMethod', () => {
      it('should work correctly', async () => {
        // Arrange
        const testData = TestDataFactory.user().withEmail('test@example.com').build()

        // Act
        const result = await this.service.myMethod(testData.id)

        // Assert
        expect(result).toBeDefined()
      })
    })
  }
}

// Exécution des tests
describe('MyService', () => {
  const myServiceTest = new MyServiceTest()

  beforeEach(async () => {
    await myServiceTest.setupTest()
  })

  afterEach(async () => {
    await myServiceTest.cleanupTest()
  })

  myServiceTest.testMyMethod()
})
```

### Builders pour les données de test

Au lieu d'utiliser des objets statiques, utilisez les builders pour plus de flexibilité :

```typescript
// ❌ Ancien style (rigide)
const mockUser = {
  id: '1',
  email: 'test@example.com',
  isActive: true
}

// ✅ Nouveau style (flexible)
const testUser = TestDataFactory.user().withId('user-123').withEmail('john.doe@example.com').withActiveStatus(false).build()

const inactiveUser = TestDataFactory.user().withActiveStatus(false).build()
```

### Scénarios de test

Utilisez `TestScenario` pour organiser des configurations de test complexes :

```typescript
const successScenario = TestScenario.create(
  'successful operation',
  async () => {
    // Setup pour ce scénario
    mockService.findUser.mockResolvedValue(testUser)
    mockService.updateUser.mockResolvedValue(updatedUser)
  },
  async () => {
    // Cleanup spécifique au scénario (optionnel)
  }
)

it('should handle success case', async () => {
  await successScenario.execute(async () => {
    const result = await service.updateUser(testUser.id, updateData)
    expect(result).toEqual(updatedUser)
  })
})
```

### Assertions avancées

```typescript
// Vérification de structure d'objet
TestAssertions.assertObjectStructure(result, {
  id: 'string',
  name: 'string',
  isActive: 'boolean',
  metadata: {
    createdAt: 'string',
    updatedAt: 'string'
  }
})

// Vérification d'erreurs avec message spécifique
await TestAssertions.assertThrows(() => service.invalidOperation(), BadRequestException, 'Expected error message')

// Vérification de l'ordre des appels de mock
TestAssertions.assertMockCallSequence(mockService.method, [
  ['arg1', 'arg2'],
  ['arg3', 'arg4']
])
```

## 🌐 Tests E2E

### Utilisation de la classe de base `E2ETestBase`

```typescript
import { E2ETestBase } from '@common/tests/e2e/base/e2e-test-base'

class MyModuleE2ETest extends E2ETestBase {
  protected getTestConfig(): E2ETestConfig {
    return {
      moduleImports: [MyModule, AuthModule, PrismaModule],
      testUsers: [
        {
          email: 'admin@test.com',
          password: 'TestPassword123',
          firstname: 'Admin',
          lastname: 'User',
          roles: ['admin'],
          identifier: 'admin'
        },
        {
          email: 'user@test.com',
          password: 'TestPassword123',
          firstname: 'Regular',
          lastname: 'User',
          roles: ['user'],
          identifier: 'user'
        }
      ]
    }
  }

  async testEndpoints(): Promise<void> {
    describe('API Endpoints', () => {
      it('should allow admin access', async () => {
        await this.loginAs('admin')

        const response = await this.testEndpoint({
          method: 'GET',
          endpoint: '/api/admin/users',
          expectedStatus: 200,
          authenticated: true
        })

        expect(response.body).toHaveProperty('users')
      })

      it('should deny user access to admin endpoints', async () => {
        await this.testEndpoint({
          method: 'GET',
          endpoint: '/api/admin/users',
          expectedStatus: 403,
          userIdentifier: 'user'
        })
      })
    })
  }
}

describe('MyModule (e2e)', () => {
  const e2eTest = new MyModuleE2ETest()

  beforeAll(async () => {
    await e2eTest.setupE2ETest()
  })

  afterAll(async () => {
    await e2eTest.cleanupE2ETest()
  })

  e2eTest.testEndpoints()
})
```

## 📋 Bonnes Pratiques

### 1. Organisation des tests

- **Groupez les tests par fonctionnalité** : Une méthode de test par fonctionnalité principale
- **Utilisez des noms descriptifs** : `testFetchUserWithValidId()` plutôt que `testFetch()`
- **Séparez les scénarios** : Success, error cases, edge cases

### 2. Données de test

- **Utilisez les builders** : Plus flexibles que les objets statiques
- **Créez des données spécifiques** : Chaque test devrait avoir ses propres données
- **Évitez les dépendances entre tests** : Chaque test doit être indépendant

### 3. Mocks et stubs

- **Utilisez MockManager** : Pour organiser vos mocks
- **Configurez les mocks au bon endroit** : Dans `customSetup()` ou dans les scénarios
- **Vérifiez les interactions importantes** : N'hésitez pas à vérifier que les bonnes méthodes sont appelées

### 4. Assertions

- **Soyez spécifiques** : Vérifiez la structure exacte des objets retournés
- **Testez les cas d'erreur** : Utilisez `TestAssertions.assertThrows()`
- **Vérifiez les effets de bord** : Logs, appels de services externes, etc.

## 🔄 Migration depuis l'ancien système

### Étapes de migration

1. **Créez une nouvelle classe de test** héritant de `ServiceTestBase`
2. **Remplacez les objets mock statiques** par des builders
3. **Organisez les tests en méthodes** plutôt qu'en blocs `describe` imbriqués
4. **Utilisez les utilitaires avancés** pour les assertions complexes
5. **Testez et comparez** avec les anciens tests

### Exemple de migration

```typescript
// ❌ Ancien style
describe('UserService', () => {
  let service: UserService
  let prismaService: jest.Mocked<PrismaService>

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrismaService }]
    }).compile()

    service = module.get<UserService>(UserService)
    prismaService = module.get(PrismaService)
  })

  describe('findById', () => {
    it('should return user', async () => {
      const mockUser = { id: '1', email: 'test@example.com' }
      prismaService.user.findUnique.mockResolvedValue(mockUser)

      const result = await service.findById('1')
      expect(result).toEqual(mockUser)
    })
  })
})

// ✅ Nouveau style
class UserServiceTest extends ServiceTestBase<UserService> {
  protected getServiceClass() {
    return UserService
  }
  protected getProviders(): Provider[] {
    return [{ provide: PrismaService, useValue: mockPrismaService }]
  }

  testFindById(): void {
    describe('findById', () => {
      it('should return user', async () => {
        const testUser = TestDataFactory.user().build()
        this.getService(PrismaService).user.findUnique.mockResolvedValue(testUser)

        const result = await this.service.findById(testUser.id)
        expect(result).toEqual(testUser)
      })
    })
  }
}
```

## 🐛 Débogage et résolution de problèmes

### Problèmes courants

1. **Mocks non configurés** : Vérifiez que tous les mocks nécessaires sont configurés dans `customSetup()`
2. **Tests qui se polluent** : Assurez-vous que `clearAllMocks()` est appelé correctement
3. **Données de test invalides** : Utilisez les builders pour créer des données cohérentes

### Outils de débogage

```typescript
// Utiliser MockManager pour tracer les appels
const mockManager = new MockManager()
const trackedMock = mockManager.createMock('myMethod', (...args) => {
  console.log('Mock called with:', args)
  return 'result'
})

// Mesurer les performances
const { result, executionTime } = await PerformanceTestHelper.measureExecutionTime(() => service.heavyOperation())
console.log(`Operation took ${executionTime}ms`)
```

## 📊 Métriques et couverture

La nouvelle infrastructure facilite également :

- **Mesure de couverture** : Tests plus ciblés et organisés
- **Métriques de performance** : Outils intégrés pour mesurer les temps d'exécution
- **Rapport de qualité** : Structure cohérente pour l'analyse des tests

## 🚀 Prochaines étapes

1. **Migrer progressivement** les tests existants vers la nouvelle infrastructure
2. **Créer des templates** pour les nouveaux modules
3. **Ajouter des règles ESLint** pour enforcer les bonnes pratiques
4. **Documenter les patterns spécifiques** à votre domaine d'application
