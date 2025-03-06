import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { INestApplication } from '@nestjs/common'
import { writeFileSync, readFileSync } from 'fs'
import { join } from 'path'

export function setupOpenApi(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('BillMate API')
    .setDescription('An open-source solution for managing clients, invoices, and financial tasks.')
    .setVersion(process.env.npm_package_version || '1.0.0')
    .setContact('BillMate Team', 'https://github.com/agachet/billmate-backend', 'anthony.gachet@diamondforge.fr')
    .setLicense('MIT', 'https://opensource.org/licenses/MIT')
    .addBearerAuth()
    .build()

  const document = SwaggerModule.createDocument(app, config)

  // Créer le dossier api/docs si nécessaire
  const docsPath = join(process.cwd(), 'src/configs/open-api/static')
  const apiDocsPath = join(docsPath, 'openapi.json')

  // Écrire le fichier openapi.json
  writeFileSync(apiDocsPath, JSON.stringify(document, null, 2))

  // Servir les fichiers statiques pour la documentation
  app.use('/api/docs/openapi.json', (req, res) => {
    res.json(document)
  })

  app.use('/api/docs', (req, res) => {
    if (req.path === '/') {
      const html = readFileSync(join(docsPath, 'index.html'), 'utf8')
      res.type('html').send(html)
    }
  })
}
