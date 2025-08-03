// Personal Cloud Storage JavaScript with Google Drive Integration

class CloudStorage {
    constructor() {
        this.currentPath = '/';
        this.files = [];
        this.currentView = 'grid';
        this.uploadQueue = [];
        this.totalStorageLimit = 0; // Will be set by backend
        this.lastUploadTime = null;
        this.isLoading = false;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFiles(); // Load files from Google Drive
        this.updateStorageDisplay();
        this.renderStorageChart();
        this.updateFileStats();
    }

    async loadFiles() {
        this.setLoading(true);
        try {
            const response = await fetch('/.netlify/functions/list-files');
            if (response.ok) {
                const data = await response.json();
                this.files = data.files || [];
                this.renderFileList();
                this.updateFileStats();
            } else {
                this.showError('Failed to load files');
            }
        } catch (error) {
            console.error('Error loading files:', error);
            this.showError('Error connecting to cloud storage');
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const loadingEl = document.querySelector('.loading-spinner');
        const fileList = document.querySelector('.file-list');
        
        if (loading) {
            if (loadingEl) loadingEl.style.display = 'flex';
            if (fileList) fileList.style.opacity = '0.5';
        } else {
            if (loadingEl) loadingEl.style.display = 'none';
            if (fileList) fileList.style.opacity = '1';
        }
    }

    showError(message) {
        // Create or update error notification
        let errorEl = document.querySelector('.error-notification');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-notification';
            document.body.appendChild(errorEl);
        }
        
        errorEl.innerHTML = `
            <div class="error-content">
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        errorEl.style.display = 'block';
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            if (errorEl.parentNode) {
                errorEl.remove();
            }
        }, 5000);
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-files');

        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));

        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.changeView(e));
        });

        // Search
        const searchInput = document.getElementById('file-search');
        searchInput.addEventListener('input', (e) => this.searchFiles(e.target.value));

        // Modal events
        this.bindModalEvents();

        // File actions
        this.bindFileActions();

        // Folder creation
        document.getElementById('new-folder-btn')?.addEventListener('click', () => this.showCreateFolderModal());
        document.getElementById('create-folder-btn')?.addEventListener('click', () => this.showCreateFolderModal());
        document.getElementById('create-folder-from-tree')?.addEventListener('click', () => this.showCreateFolderModal());
        document.getElementById('create-first-folder')?.addEventListener('click', () => this.showCreateFolderModal());
        
        // Upload redirects
        document.getElementById('upload-files-btn')?.addEventListener('click', () => this.switchToSection('upload'));
        document.getElementById('upload-first-file')?.addEventListener('click', () => this.switchToSection('upload'));
        
        // Logout functionality - redirect to login page
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            window.location.href = '/';
        });
    }

    handleNavigation(e) {
        e.preventDefault();
        const section = e.currentTarget.dataset.section;
        
        // Update active nav item
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        this.switchToSection(section);
    }

    switchToSection(section) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
        
        // Show selected section
        const targetSection = document.getElementById(section);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Update nav if not already active
        const navItem = document.querySelector(`[data-section="${section}"]`);
        if (navItem && !navItem.classList.contains('active')) {
            document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
            navItem.classList.add('active');
        }

        // Render section-specific content
        if (section === 'files') {
            this.renderFileList();
        } else if (section === 'storage') {
            this.renderStorageChart();
        }
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.addFilesToQueue(files);
    }

    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleFileDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        
        const files = Array.from(e.dataTransfer.files);
        this.addFilesToQueue(files);
    }

    addFilesToQueue(files) {
        const queueContainer = document.getElementById('upload-queue');
        const queueList = document.getElementById('queue-list');
        
        queueContainer.style.display = 'block';
        
        files.forEach(file => {
            const queueItem = this.createQueueItem(file);
            queueList.appendChild(queueItem);
            this.uploadToGoogleDrive(file, queueItem);
        });
    }

    async uploadToGoogleDrive(file, queueItem) {
        const progressBar = queueItem.querySelector('.progress');
        const statusEl = queueItem.querySelector('.upload-status');
        
        try {
            statusEl.textContent = 'Uploading...';
            
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/.netlify/functions/upload-file', {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const result = await response.json();
                progressBar.style.width = '100%';
                statusEl.textContent = 'Completed';
                queueItem.classList.add('completed');
                
                // Add file to local list and refresh display
                this.files.push(result.file);
                this.renderFileList();
                this.updateFileStats();
                
                // Remove from queue after 2 seconds
                setTimeout(() => {
                    queueItem.remove();
                    if (queueList.children.length === 0) {
                        queueContainer.style.display = 'none';
                    }
                }, 2000);
                
            } else {
                throw new Error('Upload failed');
            }
            
        } catch (error) {
            console.error('Upload error:', error);
            statusEl.textContent = 'Failed';
            queueItem.classList.add('error');
            progressBar.style.backgroundColor = '#ef4444';
        }
    }
    }

    createQueueItem(file) {
        const item = document.createElement('div');
        item.className = 'queue-item';
        item.innerHTML = `
            <div>
                <div class="file-name">${file.name}</div>
                <div class="file-size">${this.formatFileSize(file.size)}</div>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <span class="upload-status">Uploading...</span>
        `;
        return item;
    }

    changeView(e) {
        const view = e.currentTarget.dataset.view;
        this.currentView = view;
        
        document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const fileList = document.getElementById('file-list');
        if (view === 'list') {
            fileList.classList.add('list-view');
        } else {
            fileList.classList.remove('list-view');
        }
    }

    searchFiles(query) {
        const filteredFiles = this.files.filter(file => 
            file.name.toLowerCase().includes(query.toLowerCase())
        );
        this.renderFileList(filteredFiles);
    }

    renderFileList(files = null) {
        const fileList = document.getElementById('file-list');
        const filesToRender = files || this.files.filter(file => file.path === this.currentPath);
        
        fileList.innerHTML = '';
        
        if (filesToRender.length === 0) {
            fileList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No files or folders yet</p>
                    <div class="empty-actions">
                        <button class="btn btn-primary" onclick="document.querySelector('[data-section=upload]').click()">
                            <i class="fas fa-upload"></i>
                            Upload Files
                        </button>
                        <button class="btn btn-secondary" onclick="document.getElementById('create-folder-btn').click()">
                            <i class="fas fa-folder-plus"></i>
                            Create Folder
                        </button>
                    </div>
                </div>
            `;
            return;
        }
        
        filesToRender.forEach(file => {
            const fileItem = this.createFileItem(file);
            fileList.appendChild(fileItem);
        });
    }

    createFileItem(file) {
        const item = document.createElement('div');
        item.className = `file-item ${file.isFolder ? 'folder' : ''}`;
        item.dataset.type = file.isFolder ? 'folder' : 'file';
        
        const icon = this.getFileIcon(file);
        const date = file.dateCreated ? this.formatDate(file.dateCreated) : 'Unknown';
        const size = file.isFolder ? '--' : this.formatFileSize(file.size);
        
        item.innerHTML = `
            <div class="file-icon">
                <i class="${icon}"></i>
            </div>
            <span class="file-name">${file.name}</span>
            <span class="file-size">${size}</span>
            <span class="file-date">${date}</span>
            <div class="file-actions">
                ${!file.isFolder ? '<button class="action-btn" data-action="download"><i class="fas fa-download"></i></button>' : ''}
                <button class="action-btn" data-action="rename"><i class="fas fa-edit"></i></button>
                <button class="action-btn" data-action="delete"><i class="fas fa-trash"></i></button>
            </div>
        `;
        
        // Add click handler for folders
        if (file.isFolder) {
            item.addEventListener('dblclick', () => this.navigateToFolder(file.path + file.name + '/'));
        }
        
        return item;
    }

    getFileIcon(file) {
        if (file.isFolder) return 'fas fa-folder';
        
        const extension = file.name.split('.').pop().toLowerCase();
        const iconMap = {
            'pdf': 'fas fa-file-pdf',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            'txt': 'fas fa-file-alt',
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'png': 'fas fa-file-image',
            'gif': 'fas fa-file-image',
            'mp4': 'fas fa-file-video',
            'avi': 'fas fa-file-video',
            'mov': 'fas fa-file-video',
            'mp3': 'fas fa-file-audio',
            'wav': 'fas fa-file-audio',
            'zip': 'fas fa-file-archive',
            'rar': 'fas fa-file-archive',
            'js': 'fas fa-file-code',
            'html': 'fas fa-file-code',
            'css': 'fas fa-file-code',
            'py': 'fas fa-file-code'
        };
        
        return iconMap[extension] || 'fas fa-file';
    }

    navigateToFolder(path) {
        this.currentPath = path;
        this.updateBreadcrumb();
        this.renderFileList();
    }

    updateBreadcrumb() {
        const breadcrumb = document.querySelector('.breadcrumb');
        const pathParts = this.currentPath.split('/').filter(part => part);
        
        breadcrumb.innerHTML = '<span class="breadcrumb-item active">Root</span>';
        
        let currentPath = '/';
        pathParts.forEach(part => {
            currentPath += part + '/';
            const item = document.createElement('span');
            item.className = 'breadcrumb-item';
            item.textContent = part;
            item.addEventListener('click', () => this.navigateToFolder(currentPath));
            breadcrumb.appendChild(item);
        });
    }

    bindModalEvents() {
        const modal = document.getElementById('create-folder-modal');
        const closeBtn = modal.querySelector('.modal-close');
        const cancelBtn = document.getElementById('cancel-folder');
        const confirmBtn = document.getElementById('confirm-folder');
        const input = document.getElementById('folder-name-input');

        closeBtn.addEventListener('click', () => this.hideCreateFolderModal());
        cancelBtn.addEventListener('click', () => this.hideCreateFolderModal());
        confirmBtn.addEventListener('click', () => this.createFolder());
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.createFolder();
            if (e.key === 'Escape') this.hideCreateFolderModal();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) this.hideCreateFolderModal();
        });
    }

    showCreateFolderModal() {
        const modal = document.getElementById('create-folder-modal');
        const input = document.getElementById('folder-name-input');
        
        modal.classList.add('show');
        input.value = '';
        input.focus();
    }

    hideCreateFolderModal() {
        const modal = document.getElementById('create-folder-modal');
        modal.classList.remove('show');
    }

    async createFolder() {
        const input = document.getElementById('folder-name-input');
        const folderName = input.value.trim();
        
        if (!folderName) {
            alert('Please enter a folder name');
            return;
        }
        
        if (this.files.some(file => file.name === folderName)) {
            alert('A folder with this name already exists');
            return;
        }
        
        try {
            const response = await fetch('/.netlify/functions/create-folder', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folderName })
            });

            if (response.ok) {
                const result = await response.json();
                this.files.push(result.folder);
                this.hideCreateFolderModal();
                this.renderFileList();
                this.updateFileStats();
            } else {
                throw new Error('Failed to create folder');
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            this.showError('Failed to create folder');
        }
    }

    bindFileActions() {
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('action-btn') || e.target.parentElement.classList.contains('action-btn')) {
                const actionBtn = e.target.classList.contains('action-btn') ? e.target : e.target.parentElement;
                const action = actionBtn.dataset.action;
                const fileItem = actionBtn.closest('.file-item');
                const fileName = fileItem.querySelector('.file-name').textContent;
                
                this.handleFileAction(action, fileName, fileItem);
            }
        });
    }

    handleFileAction(action, fileName, fileItem) {
        switch (action) {
            case 'download':
                this.downloadFile(fileName);
                break;
            case 'rename':
                this.renameFile(fileName, fileItem);
                break;
            case 'delete':
                this.deleteFile(fileName, fileItem);
                break;
        }
    }

    downloadFile(fileName) {
        // Simulate file download
        const link = document.createElement('a');
        link.href = '#';
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show notification
        this.showNotification(`Downloading ${fileName}...`, 'success');
    }

    renameFile(oldName, fileItem) {
        const newName = prompt('Enter new name:', oldName);
        if (newName && newName !== oldName) {
            const file = this.files.find(f => f.name === oldName && f.path === this.currentPath);
            if (file) {
                file.name = newName;
                fileItem.querySelector('.file-name').textContent = newName;
                this.showNotification(`Renamed to ${newName}`, 'success');
            }
        }
    }

    async deleteFile(fileName, fileItem) {
        if (confirm(`Are you sure you want to delete "${fileName}"?`)) {
            const file = this.files.find(f => f.name === fileName);
            if (!file) return;
            
            try {
                const response = await fetch('/.netlify/functions/delete-file', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fileId: file.id })
                });

                if (response.ok) {
                    const fileIndex = this.files.findIndex(f => f.id === file.id);
                    if (fileIndex > -1) {
                        this.files.splice(fileIndex, 1);
                        fileItem.remove();
                        this.updateFileStats();
                        this.showNotification(`Deleted ${fileName}`, 'success');
                    }
                } else {
                    throw new Error('Failed to delete file');
                }
            } catch (error) {
                console.error('Error deleting file:', error);
                this.showError('Failed to delete file');
            }
        }
    }

    updateFileStats() {
        const totalFiles = this.files.filter(f => !f.isFolder).length;
        const totalFolders = this.files.filter(f => f.isFolder).length;
        
        document.getElementById('total-files').textContent = totalFiles;
        document.getElementById('total-folders').textContent = totalFolders;
        
        // Update last upload display
        const lastUploadEl = document.getElementById('last-upload');
        if (this.lastUploadTime) {
            const now = new Date();
            const diffMs = now - this.lastUploadTime;
            const diffMins = Math.floor(diffMs / (1000 * 60));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            
            if (diffMins < 1) {
                lastUploadEl.textContent = 'Just now';
            } else if (diffMins < 60) {
                lastUploadEl.textContent = `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
            } else if (diffHours < 24) {
                lastUploadEl.textContent = `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
            } else {
                lastUploadEl.textContent = `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
            }
        } else {
            lastUploadEl.textContent = 'Never';
        }
    }

    updateStorageDisplay() {
        const totalUsed = this.files.reduce((sum, file) => {
            return sum + (file.size || 0);
        }, 0);
        
        // Update header storage display
        document.getElementById('storage-used').textContent = totalUsed > 0 ? this.formatFileSize(totalUsed) : '--';
        document.getElementById('storage-total').textContent = this.totalStorageLimit > 0 ? this.formatFileSize(this.totalStorageLimit) : '--';
        
        // Update dashboard storage display
        document.getElementById('storage-used-display').textContent = this.formatFileSize(totalUsed);
        
        // Update storage bar
        const usedPercentage = this.totalStorageLimit > 0 ? (totalUsed / this.totalStorageLimit) * 100 : 0;
        document.getElementById('storage-fill').style.width = `${Math.min(usedPercentage, 100)}%`;
        
        // Update storage breakdown
        this.updateStorageBreakdown();
    }

    renderStorageChart() {
        const canvas = document.getElementById('storage-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 100;
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const breakdown = this.getStorageBreakdown();
        const totalSize = breakdown.documents + breakdown.images + breakdown.videos + breakdown.other;
        
        if (totalSize === 0) {
            // Draw empty circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fillStyle = '#334155';
            ctx.fill();
            
            // Draw center circle (donut effect)
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
            ctx.fillStyle = '#1a1f29';
            ctx.fill();
            
            // Add text in center
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No Data', centerX, centerY);
            return;
        }
        
        // Data for the chart (percentages)
        const data = [
            { label: 'Documents', value: (breakdown.documents / totalSize) * 100, color: '#3b82f6' },
            { label: 'Images', value: (breakdown.images / totalSize) * 100, color: '#10b981' },
            { label: 'Videos', value: (breakdown.videos / totalSize) * 100, color: '#f59e0b' },
            { label: 'Other', value: (breakdown.other / totalSize) * 100, color: '#ef4444' }
        ];
        
        let currentAngle = -Math.PI / 2; // Start from top
        
        data.forEach(segment => {
            if (segment.value > 0) {
                const sliceAngle = (segment.value / 100) * 2 * Math.PI;
                
                // Draw slice
                ctx.beginPath();
                ctx.moveTo(centerX, centerY);
                ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
                ctx.fillStyle = segment.color;
                ctx.fill();
                
                currentAngle += sliceAngle;
            }
        });
        
        // Draw center circle (donut effect)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 0.6, 0, 2 * Math.PI);
        ctx.fillStyle = '#1a1f29';
        ctx.fill();
        
        // Add text in center
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.formatFileSize(totalSize), centerX, centerY - 5);
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('Used', centerX, centerY + 15);
    }

    getStorageBreakdown() {
        const breakdown = { documents: 0, images: 0, videos: 0, other: 0 };
        
        this.files.forEach(file => {
            if (file.isFolder || !file.size) return;
            
            const extension = file.name.split('.').pop().toLowerCase();
            
            if (['doc', 'docx', 'pdf', 'txt', 'rtf', 'odt'].includes(extension)) {
                breakdown.documents += file.size;
            } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(extension)) {
                breakdown.images += file.size;
            } else if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv'].includes(extension)) {
                breakdown.videos += file.size;
            } else {
                breakdown.other += file.size;
            }
        });
        
        return breakdown;
    }

    updateStorageBreakdown() {
        const breakdown = this.getStorageBreakdown();
        const totalSize = breakdown.documents + breakdown.images + breakdown.videos + breakdown.other;
        
        // Update size displays
        document.getElementById('docs-size').textContent = this.formatFileSize(breakdown.documents);
        document.getElementById('images-size').textContent = this.formatFileSize(breakdown.images);
        document.getElementById('videos-size').textContent = this.formatFileSize(breakdown.videos);
        document.getElementById('other-size').textContent = this.formatFileSize(breakdown.other);
        document.getElementById('total-used').textContent = this.formatFileSize(totalSize);
        
        // Update available storage
        const available = this.totalStorageLimit > 0 ? this.totalStorageLimit - totalSize : 0;
        document.getElementById('available-storage').textContent = this.totalStorageLimit > 0 ? this.formatFileSize(available) : '-- GB';
        
        // Update legend percentages
        const docsPercent = totalSize > 0 ? Math.round((breakdown.documents / totalSize) * 100) : 0;
        const imagesPercent = totalSize > 0 ? Math.round((breakdown.images / totalSize) * 100) : 0;
        const videosPercent = totalSize > 0 ? Math.round((breakdown.videos / totalSize) * 100) : 0;
        const otherPercent = totalSize > 0 ? Math.round((breakdown.other / totalSize) * 100) : 0;
        
        document.getElementById('docs-legend').textContent = `Documents (${docsPercent}%)`;
        document.getElementById('images-legend').textContent = `Images (${imagesPercent}%)`;
        document.getElementById('videos-legend').textContent = `Videos (${videosPercent}%)`;
        document.getElementById('other-legend').textContent = `Other (${otherPercent}%)`;
    }

    updateRecentFiles() {
        const recentFilesGrid = document.getElementById('recent-files-grid');
        if (!recentFilesGrid) return;
        
        const recentFiles = this.files
            .filter(f => !f.isFolder)
            .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated))
            .slice(0, 6);
        
        if (recentFiles.length === 0) {
            recentFilesGrid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <p>No files uploaded yet</p>
                    <button class="btn btn-primary" onclick="document.querySelector('[data-section=upload]').click()">
                        <i class="fas fa-upload"></i>
                        Upload Your First File
                    </button>
                </div>
            `;
            return;
        }
        
        recentFilesGrid.innerHTML = '';
        recentFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <div class="file-icon">
                    <i class="${this.getFileIcon(file)}"></i>
                </div>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
            `;
            recentFilesGrid.appendChild(fileItem);
        });
    }

    updateFolderTree() {
        const treeContent = document.getElementById('folder-tree-content');
        if (!treeContent) return;
        
        const folders = this.files.filter(f => f.isFolder);
        
        if (folders.length === 0) {
            treeContent.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder"></i>
                    <p>No folders created yet</p>
                    <button class="btn btn-primary" onclick="document.getElementById('create-folder-btn').click()">
                        <i class="fas fa-plus"></i>
                        Create Your First Folder
                    </button>
                </div>
            `;
            return;
        }
        
        treeContent.innerHTML = '';
        this.renderFolderTree(folders, treeContent, '/');
    }

    renderFolderTree(folders, container, parentPath) {
        const foldersAtLevel = folders.filter(f => f.path === parentPath);
        
        foldersAtLevel.forEach(folder => {
            const treeItem = document.createElement('div');
            treeItem.className = 'tree-item';
            
            const treeNode = document.createElement('div');
            treeNode.className = 'tree-node';
            treeNode.innerHTML = `
                <i class="fas fa-folder"></i>
                <span>${folder.name}</span>
                <div class="tree-actions">
                    <button class="action-btn" data-action="rename"><i class="fas fa-edit"></i></button>
                    <button class="action-btn" data-action="delete"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            treeItem.appendChild(treeNode);
            
            // Check for subfolders
            const subfolders = folders.filter(f => f.path === folder.path + folder.name + '/');
            if (subfolders.length > 0) {
                const treeChildren = document.createElement('div');
                treeChildren.className = 'tree-children';
                this.renderFolderTree(folders, treeChildren, folder.path + folder.name + '/');
                treeItem.appendChild(treeChildren);
            }
            
            container.appendChild(treeItem);
        });
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background-color: var(--secondary-bg);
            border: 1px solid var(--border-color);
            border-radius: var(--radius);
            color: var(--text-primary);
            z-index: 3000;
            box-shadow: var(--shadow-lg);
            transform: translateX(100%);
            transition: transform 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    // Method to set storage limit (would be called from backend)
    setStorageLimit(limitInBytes) {
        this.totalStorageLimit = limitInBytes;
        this.updateStorageDisplay();
    }

    // Method to load files from backend
    loadFiles(filesData) {
        this.files = filesData;
        this.updateFileStats();
        this.updateStorageDisplay();
        this.updateRecentFiles();
        this.updateFolderTree();
        
        // Refresh current view
        const activeSection = document.querySelector('.content-section.active');
        if (activeSection && activeSection.id === 'files') {
            this.renderFileList();
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the cloud storage application directly
    new CloudStorage();
});

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
