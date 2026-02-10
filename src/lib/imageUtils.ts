const UNSUPPORTED_RAW_FORMATS = [
  '.dng', '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.pef', '.raf', '.raw'
];

export async function convertToJpeg(file: File, quality: number = 0.9): Promise<File> {
  // Check for unsupported RAW formats by file extension
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (UNSUPPORTED_RAW_FORMATS.includes(fileExtension)) {
    throw new Error(`RAW image format ${fileExtension.toUpperCase()} is not supported. Please convert to JPG, PNG, or another standard format first.`);
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let imageLoadTimeout: number;

    reader.onload = (e) => {
      const img = new Image();

      // Set a timeout for image loading (5 seconds)
      imageLoadTimeout = window.setTimeout(() => {
        reject(new Error('Image loading timed out. The file format may not be supported.'));
      }, 5000);

      img.onload = () => {
        clearTimeout(imageLoadTimeout);

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to convert image to JPEG'));
              return;
            }

            const originalName = file.name.replace(/\.[^/.]+$/, '');
            const jpegFile = new File([blob], `${originalName}.jpeg`, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(jpegFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        clearTimeout(imageLoadTimeout);
        reject(new Error(`Failed to load image. The file format may not be supported by your browser.`));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsDataURL(file);
  });
}

export function isImageFile(file: File): boolean {
  // Check if it's a RAW format that we don't support
  const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (UNSUPPORTED_RAW_FORMATS.includes(fileExtension)) {
    return false;
  }

  return file.type.startsWith('image/');
}

export function isJpegFile(file: File): boolean {
  return file.type === 'image/jpeg' || file.type === 'image/jpg';
}
