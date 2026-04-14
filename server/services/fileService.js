const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

// File Validation Service
exports.validateFile = (file) => {
    if (!file) {
        throw new Error('No file uploaded');
    }

    if (file.size > MAX_FILE_SIZE) {
        throw new Error('File size exceeds 20MB limit');
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']; 
    if (!allowedTypes.includes(file.mimetype)) {
        throw new Error('Invalid file type. Supported: PDF, JPG, PNG');
    }

    return true;
};

// Process File (Count Pages & Convert Images if needed)
exports.processFile = async (filePath, mimetype) => {
    try {
        const fileBuffer = fs.readFileSync(filePath);

        // If Image -> Convert to PDF
        if (mimetype.startsWith('image/')) {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage();
            
            let image;
            if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
                image = await pdfDoc.embedJpg(fileBuffer);
            } else if (mimetype === 'image/png') {
                image = await pdfDoc.embedPng(fileBuffer);
            } else {
                throw new Error('Unsupported image format');
            }

            // Scale image to fit page
            const { width, height } = image.scale(1);
            const pageWidth = page.getWidth();
            const pageHeight = page.getHeight();
            
            // Simple logic: fit to width (with margin)
            const scaffoldWidth = pageWidth - 40;
            const scaleFactor = scaffoldWidth / width;
            
            // Draw
            page.drawImage(image, {
                x: 20,
                y: pageHeight - (height * scaleFactor) - 20,
                width: width * scaleFactor,
                height: height * scaleFactor,
            });

            // Save new PDF logic
            const pdfBytes = await pdfDoc.save();
            
            // WE MUST RENAME THE FILE TO .pdf SO THE BROWSER DOESN'T GET CONFUSED
            const parsedPath = path.parse(filePath);
            const newFilePath = path.join(parsedPath.dir, parsedPath.name + '.pdf');
            
            fs.writeFileSync(newFilePath, pdfBytes); // Overwrite image with PDF version
            
            // Delete the original image file since we only need the PDF now
            if (filePath !== newFilePath) {
                fs.unlinkSync(filePath);
            }
            
            return { pageCount: 1, newFilePath: newFilePath }; // Images are always 1 page
        }

        // If PDF
        const pdfDoc = await PDFDocument.load(fileBuffer);
        return { pageCount: pdfDoc.getPageCount(), newFilePath: filePath };

    } catch (error) {
        console.error('Error processing file:', error);
        throw new Error('Could not process file (corrupted or unsupported)');
    }
};

// Clean up failed uploads
exports.deleteFile = (filePath) => {
    if (fs.existsSync(filePath)) {
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.error('Error deleting file:', e);
        }
    }
};
