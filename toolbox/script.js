document.addEventListener('DOMContentLoaded', function() {
    // 获取所有需要的DOM元素
    const upload = document.getElementById('upload');
    const qualitySlider = document.getElementById('quality');
    const qualityValue = document.getElementById('quality-value');
    const imagesGrid = document.getElementById('images-grid');
    const compressionControls = document.querySelector('.compression-controls');
    const progressModal = document.getElementById('progress-modal');
    const progressFill = document.querySelector('.progress-fill');
    const progressCount = document.getElementById('progress-count');
    const progressTotal = document.getElementById('progress-total');
    const batchResizeBtn = document.getElementById('batch-resize');
    const batchDownloadBtn = document.getElementById('batch-download');
    const batchWidthInput = document.getElementById('batch-width');
    const batchHeightInput = document.getElementById('batch-height');
    const batchKeepRatio = document.getElementById('batch-keep-ratio');
    const batchFormatSelect = document.getElementById('batch-format');

    let imageFiles = [];
    let batchAspectRatio = 1;
    let imageHistory = new Map(); // 存储图片处理历史

    // 文件上传处理

upload.addEventListener('change', function(e) {
    console.log('File input change event triggered');
    
    if (!e.target.files || e.target.files.length === 0) {
        console.log('No files selected');
        return;
    }

    const newFiles = Array.from(e.target.files).filter(file => file.type.startsWith('image/'));
    console.log('Valid image files:', newFiles.length);
    
    if (newFiles.length === 0) {
        alert('请选择有效的图片文件');
        return;
    }
    
    // 检查总文件数是否超过限制
    if (imageFiles.length + newFiles.length > 30) {
        alert('图片总数不能超过30张');
        return;
    }

    try {
        // 将新文件追加到现有文件列表中，而不是替换
        imageFiles = [...imageFiles, ...newFiles];
        updateImageGrid();
        compressionControls.style.display = 'block';

        // 获取第一张图片的格式并设置下拉框
        const firstImageFormat = newFiles[0].type;
        batchFormatSelect.value = firstImageFormat;

        // 如果是第一次上传图片，设置批量调整的默认尺寸
        if (imageFiles.length === newFiles.length) {
            const img = new Image();
            img.onload = function() {
                batchWidthInput.value = this.width;
                batchHeightInput.value = this.height;
                batchAspectRatio = this.width / this.height;
            };
            img.onerror = function() {
                console.error('Error loading first image');
            };
            img.src = URL.createObjectURL(newFiles[0]);
        }
    } catch (error) {
        console.error('Error in file upload handling:', error);
        alert('文件处理出错，请重试');
    }
});

    // 监听质量滑块变化
    qualitySlider.addEventListener('input', function(e) {
        qualityValue.textContent = e.target.value + '%';
    });

    // 批量设置的长宽比控制
    batchWidthInput.addEventListener('input', function() {
        if (batchKeepRatio.checked && this.value) {
            batchHeightInput.value = Math.round(this.value / batchAspectRatio);
        }
    });

    batchHeightInput.addEventListener('input', function() {
        if (batchKeepRatio.checked && this.value) {
            batchWidthInput.value = Math.round(this.value * batchAspectRatio);
        }
    });

    // 批量调整大小
    batchResizeBtn.addEventListener('click', async function() {
        const width = parseInt(batchWidthInput.value);
        const height = parseInt(batchHeightInput.value);
        
        if (!width || !height) {
            alert('请输入有效的宽度和高度');
            return;
        }

        showProgress(imageFiles.length);
        let processed = 0;

        try {
            const cards = document.querySelectorAll('.image-card');
            for (let card of cards) {
                const widthInput = card.querySelector('.width-input');
                const heightInput = card.querySelector('.height-input');
                const resizeBtn = card.querySelector('.resize-button');
                
                widthInput.value = width;
                heightInput.value = height;
                
                await new Promise(resolve => {
                    const observer = new MutationObserver((mutations, obs) => {
                        const previewImg = card.querySelector('.preview-img');
                        if (previewImg.style.display === 'block') {
                            obs.disconnect();
                            resolve();
                        }
                    });
                    
                    observer.observe(card, { 
                        attributes: true, 
                        childList: true, 
                        subtree: true 
                    });
                    
                    resizeBtn.click();
                });
                
                processed++;
                updateProgress(processed);
            }
        } catch (error) {
            console.error('批量调整大小失败:', error);
            alert('批量处理过程中出错，请重试');
        } finally {
            hideProgress();
        }
    });

    // 批量下载
    batchDownloadBtn.addEventListener('click', async function() {
        const processedImages = document.querySelectorAll('.preview-img');
        if (processedImages.length === 0) {
            alert('请先调整图片大小');
            return;
        }

        const selectedFormat = batchFormatSelect.value;
        showProgress(processedImages.length);
        let processed = 0;

        try {
            const zip = new JSZip();
            
            for (let img of processedImages) {
                if (img.style.display === 'block') {
                    // 转换图片格式
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    ctx.drawImage(img, 0, 0);
                    
                    const blob = await new Promise(resolve => canvas.toBlob(resolve, selectedFormat, qualitySlider.value / 100));
                    
                    const originalName = img.closest('.image-card')
                        .querySelector('.card-header h3').textContent.split('.')[0];
                    zip.file(`resized-${originalName}${getFileExtension(selectedFormat)}`, blob);
                    processed++;
                    updateProgress(processed);
                }
            }

            const content = await zip.generateAsync({type: 'blob'});
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = 'resized-images.zip';
            link.click();
        } catch (error) {
            console.error('批量下载失败:', error);
            alert('批量下载失败，请重试');
        } finally {
            hideProgress();
        }
    });

    // 进度条控制函数
    function showProgress(total) {
        progressModal.style.display = 'flex';
        progressFill.style.width = '0%';
        progressCount.textContent = '0';
        progressTotal.textContent = total;
    }

    function updateProgress(current) {
        const percentage = (current / parseInt(progressTotal.textContent)) * 100;
        progressFill.style.width = percentage + '%';
        progressCount.textContent = current;
    }

    function hideProgress() {
        progressModal.style.display = 'none';
    }

    // 创建图片卡片
    function createImageCard(file, index) {
        const card = document.createElement('div');
        card.className = 'image-card';
        card.dataset.index = index;
        
        // 获取图片实际格式
        const imageFormat = file.type;
        
        card.innerHTML = `
            <div class="card-header">
                <h3>${file.name}</h3>
                <button class="delete-button" title="删除">×</button>
            </div>
            <div class="card-content">
                <div class="image-container">
                    <div class="original-image">
                        <h4>原始图片</h4>
                        <div class="image-dimensions-overlay">
                            <span class="dimension-text"></span>
                        </div>
                        <img class="original-img" src="${URL.createObjectURL(file)}" alt="原图">
                        <div class="image-info">
                            <span>大小：${formatFileSize(file.size)}</span>
                            <span class="original-dimensions"></span>
                        </div>
                    </div>
                    <div class="preview-image">
                        <h4>调整后预览 <span class="preview-tip">（鼠标移到图上可以放大）</span></h4>
                        <div class="preview-image-container">
                            <div class="preview-placeholder" id="preview-placeholder-${index}">
                                调整大小后的图片将显示在这里
                            </div>
                            <img class="preview-img" id="preview-${index}" alt="预览" style="display: none;">
                        </div>
                        <div class="image-info">
                            <span id="compressed-size-${index}"></span>
                            <span class="preview-dimensions"></span>
                        </div>
                        <div class="image-dimensions-overlay">
                            <span class="dimension-text"></span>
                        </div>
                    </div>
                </div>
                <div class="resize-controls">
                    <div class="size-inputs">
                        <label>
                            宽度：
                            <input type="number" class="width-input" min="1" placeholder="宽度">
                        </label>
                        <label>
                            高度：
                            <input type="number" class="height-input" min="1" placeholder="高度">
                        </label>
                        <label class="keep-ratio">
                            <input type="checkbox" class="keep-ratio-input" checked>
                            保持长宽比
                        </label>
                    </div>
                    <div class="format-select-wrapper">
                        <label class="format-label">请在调整大小前先选择要下载的格式：</label>
                        <select class="format-select single-format">
                            <option value="image/jpeg" ${imageFormat === 'image/jpeg' ? 'selected' : ''}>JPEG</option>
                            <option value="image/png" ${imageFormat === 'image/png' ? 'selected' : ''}>PNG</option>
                            <option value="image/gif" ${imageFormat === 'image/gif' ? 'selected' : ''}>GIF</option>
                        </select>
                    </div>
                    <button class="resize-button">调整大小</button>
                </div>
            </div>
            <button class="download-button" id="download-${index}" style="display: none;">
                下载调整后的图片
            </button>
        `;

        initializeCardControls(card, file, index);
        return card;
    }

    // 初始化卡片控制功能
    function initializeCardControls(card, file, index) {
        const originalImg = card.querySelector('.original-img');
        const previewImg = card.querySelector('.preview-img');
        const placeholder = card.querySelector(`#preview-placeholder-${index}`);
        const widthInput = card.querySelector('.width-input');
        const heightInput = card.querySelector('.height-input');
        const keepRatioInput = card.querySelector('.keep-ratio-input');
        const resizeButton = card.querySelector('.resize-button');
        const deleteButton = card.querySelector('.delete-button');
        let aspectRatio = 1;

        originalImg.onload = function() {
            const width = this.naturalWidth;
            const height = this.naturalHeight;
            aspectRatio = width / height;
            
            widthInput.value = width;
            heightInput.value = height;
            
            card.querySelector('.original-dimensions').textContent = 
                `尺寸：${width} × ${height}`;
        };

        widthInput.addEventListener('input', function() {
            if (keepRatioInput.checked && this.value) {
                heightInput.value = Math.round(this.value / aspectRatio);
            }
        });

        heightInput.addEventListener('input', function() {
            if (keepRatioInput.checked && this.value) {
                widthInput.value = Math.round(this.value * aspectRatio);
            }
        });

        resizeButton.addEventListener('click', async function() {
            const width = parseInt(widthInput.value);
            const height = parseInt(heightInput.value);
            const selectedFormat = card.querySelector('.single-format').value;
            
            if (!width || !height) {
                alert('请输入有效的宽度和高度');
                return;
            }

            try {
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                
                await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = function() {
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve();
                    };
                    img.src = URL.createObjectURL(file);
                });

                canvas.toBlob((blob) => {
                    const compressedFile = new File([blob], file.name.split('.')[0] + getFileExtension(selectedFormat), {
                        type: selectedFormat,
                        lastModified: new Date().getTime()
                    });

                    const previewUrl = URL.createObjectURL(compressedFile);
                    
                    placeholder.style.display = 'none';
                    previewImg.style.display = 'block';
                    previewImg.src = previewUrl;
                    
                    card.querySelector('#compressed-size-' + index).textContent = 
                        `大小：${formatFileSize(compressedFile.size)}`;
                    
                    previewImg.onload = function() {
                        card.querySelector('.preview-dimensions').textContent = 
                            `尺寸：${this.naturalWidth} × ${this.naturalHeight}`;
                    };
                    
                    const downloadBtn = card.querySelector('.download-button');
                    downloadBtn.style.display = 'block';
                    downloadBtn.onclick = () => {
                        const link = document.createElement('a');
                        link.href = previewUrl;
                        link.download = 'resized-' + file.name.split('.')[0] + getFileExtension(selectedFormat);
                        link.click();
                    };
                }, selectedFormat, qualitySlider.value / 100);
            } catch (error) {
                console.error('调整大小失败:', error);
                alert('调整大小失败，请重试');
            }
        });

        deleteButton.addEventListener('click', () => {
            imageFiles.splice(index, 1);
            updateImageGrid();
        });
    }

    // 更新图片网格
    function updateImageGrid() {
        imagesGrid.innerHTML = '';
        imageFiles.forEach((file, index) => {
            const card = createImageCard(file, index);
            imagesGrid.appendChild(card);
        });
        
        if (imageFiles.length === 0) {
            compressionControls.style.display = 'none';
        }
    }

    // 格式化文件大小
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 添加辅助函数
    function getFileExtension(mimeType) {
        switch(mimeType) {
            case 'image/jpeg':
                return '.jpg';
            case 'image/png':
                return '.png';
            case 'image/gif':
                return '.gif';
            default:
                return '.jpg';
        }
    }

    // 添加全局错误处理
    window.addEventListener('unhandledrejection', function(event) {
        console.error('未处理的Promise错误:', event.reason);
        alert('操作过程中出现错误，请刷新页面重试');
    });

    // 增强文件类型检查
    function isValidImageType(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
        return validTypes.includes(file.type);
    }

    // 添加文件大小限制
    function isValidFileSize(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        return file.size <= maxSize;
    }

    function saveImageState(index, imageData) {
        if (!imageHistory.has(index)) {
            imageHistory.set(index, []);
        }
        imageHistory.get(index).push(imageData);
    }

    function undoLastOperation(index) {
        const history = imageHistory.get(index);
        if (history && history.length > 1) {
            history.pop(); // 移除当前状态
            return history[history.length - 1]; // 返回上一个状态
        }
        return null;
    }

    // 添加图片加载优化
    function loadImageOptimized(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
        });
    }

    // 添加防抖处理
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}); 