/**
 * Safe utility to handle Base64 data URIs and regular URLs in the browser.
 * Opens files inline in a new tab for instant browser preview without forcing download.
 */
export function openBase64InNewTab(base64Data: string, title: string = 'Visualizar Documento') {
  if (!base64Data) return;

  try {
    if (base64Data.startsWith('structured://') || base64Data.startsWith('stored://')) {
      console.warn('Internal resume marker cannot be opened as a browser URL:', base64Data);
      alert('Este currículo usa uma versão estruturada do PiraNegócios. Abra a versão publicada pelo perfil do candidato.');
      return;
    }

    // If standard web URL, open in new tab
    if (!base64Data.startsWith('data:')) {
      window.open(base64Data, '_blank');
      return;
    }

    const parts = base64Data.split(';base64,');
    if (parts.length < 2) {
      alert('Formato de arquivo inválido.');
      return;
    }
    
    const contentType = parts[0].split(':')[1] || 'application/pdf';
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    const blobURL = URL.createObjectURL(blob);
    
    // Open Blob URL directly in a new tab for inline browser viewing (PDF reader, Image viewer, etc)
    const newWindow = window.open(blobURL, '_blank');
    if (newWindow) {
      try {
        newWindow.document.title = title;
      } catch (e) {}
    } else {
      // Fallback if popup blocker is active
      const tempLink = document.createElement('a');
      tempLink.href = blobURL;
      tempLink.target = '_blank';
      tempLink.click();
    }
  } catch (err) {
    console.error('Error handling file preview:', err);
    alert('Erro ao abrir visualização do arquivo.');
  }
}

/**
 * Downloads a base64 or URL file directly to disk with a clean filename.
 */
export function downloadBase64File(base64Data: string, filename: string = 'documento') {
  if (!base64Data) return;

  try {
    if (base64Data.startsWith('structured://') || base64Data.startsWith('stored://')) {
      console.warn('Internal resume marker cannot be downloaded as a file:', base64Data);
      return;
    }

    if (!base64Data.startsWith('data:')) {
      const tempLink = document.createElement('a');
      tempLink.href = base64Data;
      tempLink.download = filename;
      tempLink.click();
      return;
    }

    const parts = base64Data.split(';base64,');
    if (parts.length < 2) return;
    
    const contentType = parts[0].split(':')[1] || 'application/pdf';
    const raw = window.atob(parts[1]);
    const uInt8Array = new Uint8Array(raw.length);

    for (let i = 0; i < raw.length; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    const blob = new Blob([uInt8Array], { type: contentType });
    const blobURL = URL.createObjectURL(blob);
    
    const tempLink = document.createElement('a');
    tempLink.href = blobURL;
    
    let extension = 'pdf';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
    else if (contentType.includes('word') || contentType.includes('docx')) extension = 'docx';
    
    tempLink.download = `${filename.replace(/\s+/g, '_')}.${extension}`;
    document.body.appendChild(tempLink);
    tempLink.click();
    
    setTimeout(() => {
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(blobURL);
    }, 200);
  } catch (err) {
    console.error('Error downloading file:', err);
  }
}
