import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const writeFileAsync = promisify(fs.writeFile);
// const mkdirAsync = promisify(fs.mkdir);

export class ImageService {
  private uploadsDir: string;

  constructor() {
    // Initialiser avec le chemin par défaut
    this.uploadsDir = path.join(process.cwd(), 'uploads');
    
    // Essayer plusieurs chemins possibles
    const possiblePaths = [
      path.join(process.cwd(), 'uploads'), // Développement depuis la racine
      path.join(__dirname, '../../uploads'), // Développement depuis src
      path.join(__dirname, '../uploads'), // Production depuis dist
      path.join(process.cwd(), 'dist', 'uploads') // Production build
    ];
    
    for (const dirPath of possiblePaths) {
      if (fs.existsSync(dirPath) || dirPath === path.join(process.cwd(), 'uploads')) {
        this.uploadsDir = dirPath;
        break;
      }
    }
    
    this.ensureUploadsDir();
  }

  private ensureUploadsDir(): void {
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Sauvegarder une image base64
   */
  async saveBase64Image(base64Data: string): Promise<string> {
    try {
      if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        return base64Data; // Retourner l'URL telle quelle
      }
      
      if (base64Data.startsWith('file://')) {
        throw new Error('Les chemins file:// ne sont pas supportés. Utilisez base64.');
      }

      const matches = base64Data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        return base64Data;
      }

      const mimeType = matches[1];
      const data = matches[2];
      const extension = this.getExtensionFromMimeType(mimeType);
      const filename = `${uuidv4()}.${extension}`;
      const filepath = path.join(this.uploadsDir, filename);

      // Convertir base64 en buffer
      const buffer = Buffer.from(data, 'base64');

      // Vérifier la taille (max 5MB)
      if (buffer.length > 5 * 1024 * 1024) {
        throw new Error('Image trop grande (max 5MB)');
      }

      // Sauvegarder le fichier
      await writeFileAsync(filepath, buffer);

      // Retourner le chemin relatif pour servir via express.static
      const relativePath = path.relative(process.cwd(), filepath);
      return relativePath.startsWith('uploads') ? `/${relativePath.replace(/\\/g, '/')}` : `/uploads/${filename}`;
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'image:', error);
      return base64Data;
    }
  }

  /**
   * Sauvegarder plusieurs images
   */
  async saveMultipleImages(images: string[]): Promise<string[]> {
    const savedPaths: string[] = [];

    for (const image of images) {
      if (image && image.trim() !== '') {
        try {
          const path = await this.saveBase64Image(image);
          savedPaths.push(path);
        } catch (error) {
          console.error('Erreur lors de la sauvegarde d\'une image:', error);
          savedPaths.push(image);
        }
      }
    }

    return savedPaths;
  }

  /**
   * Obtenir l'URL complète d'une image
   */
  getImageUrl(imagePath: string, req?: any): string {
    if (!imagePath) return '';
    
    // Si c'est déjà une URL complète
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    
    // Si c'est base64, retourner tel quel
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    
    let baseUrl = process.env.API_URL || 'http://localhost:8080';
    
    if (req) {
      const protocol = req.protocol;
      const host = req.get('host');
      baseUrl = `${protocol}://${host}`;
    }
    
    return `${baseUrl}${imagePath.startsWith('/') ? imagePath : '/' + imagePath}`;
  }

  /**
   * Obtenir les URLs complètes pour plusieurs images
   */
  getImageUrls(imagePaths: string[], req?: any): string[] {
    return imagePaths
      .filter(img => img && img.trim() !== '')
      .map(img => this.getImageUrl(img, req));
  }

  /**
   * Supprimer une image
   */
  async deleteImage(imagePath: string): Promise<void> {
    if (!imagePath || imagePath.startsWith('http')) {
      return; // Ne pas supprimer les URLs externes
    }

    const filename = path.basename(imagePath);
    const filepath = path.join(this.uploadsDir, filename);

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }

  /**
   * Supprimer plusieurs images
   */
  async deleteMultipleImages(imagePaths: string[]): Promise<void> {
    for (const imagePath of imagePaths) {
      await this.deleteImage(imagePath);
    }
  }

  /**
   * Obtenir l'extension à partir du type MIME
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg'
    };

    return extensions[mimeType] || 'jpg';
  }
}

export const imageService = new ImageService();