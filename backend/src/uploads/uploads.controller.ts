import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FirebaseAuthGuard } from '../auth/auth.guard';

@Controller('uploads')
@UseGuards(FirebaseAuthGuard) // Apenas usuários logados podem fazer upload
export class UploadsController {
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  uploadFile(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('Nenhum arquivo enviado');
    }

    // Opcional: salvar a referência do arquivo no banco associado ao req['user'].uid

    return {
      message: 'Upload realizado com sucesso',
      // Retorna a URL pública do arquivo (supondo que o NestJS esteja servindo a pasta estática)
      // A rota passa pelo proxy /api no ambiente publicado; evita URLs que só
      // funcionam diretamente na porta interna do Nest.
      url: `${req.protocol}://${req.get('Host')}/api/uploads/${file.filename}`,
    };
  }
}
