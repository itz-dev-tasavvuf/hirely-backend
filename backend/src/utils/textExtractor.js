import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export class TextExtractor {
  static async extractText(buffer, mimetype, filename) {
    try {
      let text = '';
      
      switch (mimetype) {
        case 'application/pdf':
          text = await this.extractFromPDF(buffer);
          break;
        case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
          text = await this.extractFromDOCX(buffer);
          break;
        case 'application/msword':
          // For older .doc files, we'll try mammoth which has some support
          text = await this.extractFromDOCX(buffer);
          break;
        case 'text/plain':
          text = buffer.toString('utf-8');
          break;
        default:
          throw new Error(`Unsupported file type: ${mimetype}`);
      }

      // Clean up the extracted text
      text = this.cleanText(text);
      
      if (!text || text.trim().length < 50) {
        throw new Error('Extracted text is too short or empty');
      }

      return text;
    } catch (error) {
      console.error('Text extraction error:', error);
      throw new Error(`Failed to extract text from ${filename}: ${error.message}`);
    }
  }

  static async extractFromPDF(buffer) {
    try {
      const data = await pdfParse(buffer);
      return data.text;
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  static async extractFromDOCX(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch (error) {
      throw new Error(`DOCX parsing failed: ${error.message}`);
    }
  }

  static cleanText(text) {
    if (!text) return '';
    
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove page breaks and form feeds
      .replace(/[\f\r]/g, '')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim();
  }

  static validateFileType(mimetype, filename) {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];

    if (!allowedTypes.includes(mimetype)) {
      throw new Error(`File type not supported. Supported types: PDF, DOCX, DOC, TXT. Received: ${mimetype}`);
    }

    // Additional validation based on file extension
    const extension = filename.toLowerCase().split('.').pop();
    const validExtensions = ['pdf', 'docx', 'doc', 'txt'];
    
    if (!validExtensions.includes(extension)) {
      throw new Error(`File extension not supported: .${extension}`);
    }

    return true;
  }
}

export default TextExtractor;
</invoke>