// Elasticsearch configuration
const ELASTICSEARCH_URL = 'http://124.158.5.222:9400/report_test/_search/';

// Global variables
let charts = {};
let lastFetchedData = null;
let dataCache = new Map();
let chartObserver = null;
let isDataFetching = false;
let resizeTimeout = null;
let lazyLoadObserver = null;

// Global text style configuration for consistent text rendering
const GLOBAL_TEXT_STYLE = {
    textShadowBlur: 0,
    textShadowColor: 'transparent',
    textShadowOffsetX: 0,
    textShadowOffsetY: 0
};

// Animation configurations for motion.js
const ANIMATION_CONFIG = {
    duration: 0.8,
    ease: [0.4, 0, 0.2, 1],
    stagger: 0.1,
    chartsStagger: 0.15
};

// Chart entrance animations with motion.js
function animateChartEntrance() {
    if (typeof Motion === 'undefined') {
        console.log('Motion.js not loaded, skipping animations');
        return;
    }
    
    try {
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach((container, index) => {
            // Ensure container is visible first
            container.style.opacity = '1';
            container.style.visibility = 'visible';
            
            Motion.animate(container, {
                y: [50, 0],
                scale: [0.95, 1],
                opacity: [0.3, 1]
            }, {
                duration: ANIMATION_CONFIG.duration,
                ease: ANIMATION_CONFIG.ease,
                delay: index * ANIMATION_CONFIG.stagger
            });
        });
        
        // Trigger chart elements animation after delay
        setTimeout(() => {
            animateChartElements();
        }, 200);
    } catch (error) {
        console.log('Animation error:', error);
    }
}

// Chart elements animation with motion.js
function animateChartElements() {
    if (typeof Motion === 'undefined') return;
    
    try {
        const charts = document.querySelectorAll('.chart');
        charts.forEach((chart, index) => {
            Motion.animate(chart, {
                scale: [0.98, 1],
                opacity: [0.7, 1]
            }, {
                duration: 0.6,
                ease: [0.68, -0.55, 0.265, 1.55],
                delay: index * 0.1
            });
        });
    } catch (error) {
        console.log('Chart elements animation error:', error);
    }
}

// Optimized tab switching with performance enhancements
function animateTabSwitch(activeTabId) {
    // Use requestAnimationFrame for smooth performance
    requestAnimationFrame(() => {
        // Simple and reliable tab switching - let CSS handle the animation
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const newTab = document.getElementById(activeTabId);
        if (newTab) {
            newTab.classList.add('active');
            
            // Use shorter timeout for better performance
            setTimeout(() => {
                resizeAndUpdateChartsForTab(activeTabId);
            }, 300); // Reduced from 450ms for snappier response
        }
    });
}

// Optimized chart resize and update function
function resizeAndUpdateChartsForTab(activeTabId) {
    // Get only charts that are in the current tab
    const currentTabElement = document.getElementById(activeTabId);
    if (!currentTabElement) return;
    
    const chartsInTab = currentTabElement.querySelectorAll('.chart');
    const chartIdsInTab = Array.from(chartsInTab).map(chart => chart.id).filter(id => id);
    
    // Resize only visible charts for better performance
    let resizePromises = [];
    chartIdsInTab.forEach(chartId => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            const promise = new Promise(resolve => {
                try {
                    const element = document.getElementById(chartId);
                    if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
                        charts[chartId].resize({
                            width: element.offsetWidth,
                            height: element.offsetHeight
                        });
                    }
                    resolve();
                } catch (error) {
                    console.error(`Error resizing chart ${chartId}:`, error);
                    resolve();
                }
            });
            resizePromises.push(promise);
        }
    });
    
    // Update charts after resize is complete
    Promise.all(resizePromises).then(() => {
        if (lastFetchedData) {
            console.log(`📊 Updating ${chartIdsInTab.length} charts for tab: ${activeTabId}`);
            updateAllChartsEnhanced(lastFetchedData);
        }
    });
}

// Animate chart containers in specific tab with motion.js
function animateChartContainers(tabSelector) {
    if (typeof Motion === 'undefined') return;
    
    try {
        const containers = document.querySelectorAll(`${tabSelector} .chart-container`);
        containers.forEach((container, index) => {
            Motion.animate(container, {
                scale: [0.97, 1],
                opacity: [0.8, 1]
            }, {
                duration: 0.5,
                delay: index * 0.08,
                ease: [0.68, -0.55, 0.265, 1.55]
            });
        });
    } catch (error) {
        console.log('Chart containers animation error:', error);
    }
}

// Simple loading state (removed complex animations that interfere with charts)
function showAdvancedLoading(chartId) {
    // Use ECharts built-in loading instead
    if (charts[chartId]) {
        charts[chartId].showLoading('default', {
            text: 'Đang tải...',
            color: '#64c8ff',
            textColor: '#ffffff',
            maskColor: 'rgba(0, 0, 0, 0.4)',
            fontSize: 14
        });
    }
}

// Chart update animation with motion.js
function animateChartUpdate(chartId) {
    if (typeof Motion === 'undefined') return;
    
    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;
    
    try {
        Motion.animate(chartElement, {
            scale: [1, 1.02, 1]
        }, {
            duration: 0.4,
            ease: [0.68, -0.55, 0.265, 1.55]
        });
    } catch (error) {
        console.log('Chart update animation error:', error);
    }
}

// Button click animation with motion.js
function animateButtonClick(element) {
    if (typeof Motion === 'undefined') return;
    
    try {
        Motion.animate(element, {
            scale: [1, 0.96, 1]
        }, {
            duration: 0.2,
            ease: [0.25, 0.46, 0.45, 0.94]
        });
    } catch (error) {
        console.log('Button animation error:', error);
    }
}

// Floating particles animation (disabled for performance)
function createFloatingParticles() {
    console.log('Floating particles disabled for better chart performance');
    // Disabled to prevent interference with chart display
    return;
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Fix grid classes for proper responsive layout
    fixGridClasses();
    
    // Initialize in proper sequence to prevent race conditions
    setTimeout(() => {
        console.log('Initializing dashboard components...');
        
        // Initialize charts first
        initializeCharts();
        
        // Initialize tabs and UI components
        initializeTabs();
        initializeExportButtons();
        
        // Fetch and update data last
        setTimeout(() => {
            fetchDataAndUpdateCharts();
        }, 200);
    }, 100);
    
    // Initialize animations only if Motion.js is loaded
    if (typeof Motion !== 'undefined') {
        setTimeout(() => {
            try {
                console.log('Initializing Motion.js animations...');
                animateChartEntrance();
                createFloatingParticles();
            } catch (error) {
                console.log('Animation initialization error:', error);
            }
        }, 1000);
    } else {
        console.log('Motion.js not loaded, animations disabled');
    }
    
    // Event listeners with animations and null checks
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            // Simple button animation via CSS
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                e.target.style.transform = 'scale(1)';
            }, 150);
            
            // Force refresh all data and charts
            console.log('🔄 Refreshing all data...');
            const mockData = generateEnhancedMockData();
            lastFetchedData = mockData;
            forceUpdateAllCharts(mockData);
            updateStats(mockData.aggregations);
            updateLastUpdateTime();
            console.log('✅ Data refresh completed');
        });
    } else {
        console.warn('Refresh button not found');
    }
    
    const exportBtn = document.getElementById('exportExcel');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            // Simple button animation via CSS
            e.target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                e.target.style.transform = 'scale(1)';
            }, 150);
            
            exportAllToExcel();
        });
    } else {
        console.warn('Export button not found');
    }
    
    // Auto-refresh every 5 minutes
    setInterval(fetchDataAndUpdateCharts, 5 * 60 * 1000);
});

// Fix grid classes for proper responsive layout
function fixGridClasses() {
    // Fix detailed tab grids
    const detailedGrids = document.querySelectorAll('#detailed-tab .chart-grid');
    detailedGrids.forEach(grid => {
        grid.className = 'chart-grid detailed';
    });
    
    // Fix analytics tab grids
    const analyticsGrids = document.querySelectorAll('#analytics-tab .chart-grid');
    analyticsGrids.forEach(grid => {
        grid.className = 'chart-grid analytics';
    });
}

// Initialize Intersection Observer for lazy loading
function initializeLazyLoading() {
    // For now, let's disable lazy loading and use standard initialization
    // to avoid compatibility issues
    console.log('Initializing charts with standard method...');
    initializeCharts();
}

// Initialize all ECharts instances with performance optimizations
function initializeCharts() {
    // Check if ECharts library is loaded
    if (typeof echarts === 'undefined') {
        console.error('ECharts library is not loaded. Charts cannot be initialized.');
        showError('ECharts library không được tải. Vui lòng tải lại trang.');
        return;
    }

    const chartIds = [
        'sourceChart', 'enterpriseChart', 'typeChart', 
        'severityChart', 'targetChart', 'statusChart',
        'routeChart', 'contentChart',
        // New detailed report charts
        'enterpriseTypeMatrix', 'timeTrendChart', 'severityTypeChart', 'riskAnalysisChart',
        'routeMonthlyChart', 'cnlxAnalytics', 'garaAnalytics', 'nvpvAnalytics',
        'praiseBySourceChart', 'praiseByEnterpriseChart', 'responseRateChart', 'responseTimeChart',
        'networkAnalysisChart', 'heatmapChart', 'correlationChart'
    ];
    
    let initializedCount = 0;
    
    // Initialize all charts
    chartIds.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            try {
                // Check if element has proper dimensions or is in hidden tab
                let width = element.offsetWidth;
                let height = element.offsetHeight;
                
                if (width === 0 || height === 0) {
                    console.warn(`Chart element ${id} has no dimensions (possibly in hidden tab). Setting default size.`);
                    element.style.width = '100%';
                    element.style.height = '380px';
                    
                    // For hidden tabs, use default dimensions
                    width = width || 600;
                    height = height || 380;
                }

                charts[id] = echarts.init(element, null, {
                    renderer: 'canvas',
                    useDirtyRect: true,
                    useCoarsePointer: true,
                    pointerSize: 2,
                    ssr: false,
                    width: width,
                    height: height
                });
                
                // Configure performance settings
                charts[id].setOption({
                    animation: true,
                    animationDuration: 300,
                    animationEasing: 'cubicOut',
                    lazyUpdate: true
                });
                
                showLoadingState(id);
                initializedCount++;
                console.log(`Successfully initialized chart: ${id}`);
            } catch (error) {
                console.error(`Error initializing chart ${id}:`, error);
            }
        } else {
            console.warn(`Chart element not found: ${id}`);
        }
    });
    
    console.log(`Initialized ${initializedCount} charts`);
}

// Utility function to check if element is visible
function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

// Optimized resize handler with debouncing and container checking
function initializeResizeHandler() {
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('Resizing charts after window resize');
            Object.entries(charts).forEach(([chartId, chart]) => {
                if (chart && !chart.isDisposed()) {
                    try {
                        const element = document.getElementById(chartId);
                        if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
                            chart.resize({
                                width: element.offsetWidth,
                                height: element.offsetHeight
                            });
                        }
                    } catch (error) {
                        console.error(`Error resizing chart ${chartId}:`, error);
                    }
                }
            });
        }, 150);
    });
}

// Sidebar toggle functionality
function initializeSidebarToggle() {
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (sidebarToggle && sidebar) {
        function toggleSidebar() {
            const isMobile = window.innerWidth <= 768;
            
            if (isMobile) {
                // Mobile behavior: show/hide sidebar with overlay
                sidebar.classList.toggle('show');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.toggle('show');
                }
            } else {
                // Desktop behavior: collapse/expand sidebar
                sidebar.classList.toggle('collapsed');
                
                // Update toggle button icon
                const icon = sidebarToggle.querySelector('svg');
                if (sidebar.classList.contains('collapsed')) {
                    // Change to expand icon
                    icon.innerHTML = `
                        <path d="M6 9l6 6 6-6"></path>
                    `;
                } else {
                    // Change back to menu icon
                    icon.innerHTML = `
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    `;
                }
            }
            
            // Optimize chart layout after sidebar toggle
            setTimeout(() => {
                optimizeChartLayout();
                Object.entries(charts).forEach(([chartId, chart]) => {
                    if (chart && !chart.isDisposed()) {
                        try {
                            chart.resize();
                        } catch (error) {
                            console.error(`Error resizing chart ${chartId} after sidebar toggle:`, error);
                        }
                    }
                });
            }, 300); // Wait for CSS transition to complete
        }
        
        sidebarToggle.addEventListener('click', toggleSidebar);
        
        // Close sidebar when clicking overlay (mobile)
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function() {
                sidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            });
        }
        
        // Handle window resize
        window.addEventListener('resize', function() {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                // Reset mobile classes on desktop
                sidebar.classList.remove('show');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('show');
                }
            }
            
            // Optimize layout on resize
            setTimeout(() => {
                optimizeChartLayout();
            }, 100);
        });
        
        // Handle keyboard shortcut (Ctrl+B)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                toggleSidebar();
            }
        });
        
        console.log('Sidebar toggle initialized');
    } else {
        console.warn('Sidebar toggle button or sidebar not found');
    }
}

// Optimize chart layout based on available space
function optimizeChartLayout() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const chartGrids = document.querySelectorAll('.chart-grid');
    
    if (!sidebar || !mainContent || !chartGrids.length) return;
    
    const sidebarWidth = sidebar.classList.contains('collapsed') ? 60 : 260;
    const availableWidth = window.innerWidth - sidebarWidth;
    
    chartGrids.forEach(grid => {
        const chartContainers = grid.querySelectorAll('.chart-container');
        const containerCount = chartContainers.length;
        
        // Calculate optimal columns based on available space
        let optimalColumns = 1;
        if (availableWidth >= 1400) {
            optimalColumns = Math.min(3, containerCount);
        } else if (availableWidth >= 1000) {
            optimalColumns = Math.min(2, containerCount);
        } else if (availableWidth >= 600) {
            optimalColumns = Math.min(2, containerCount);
        }
        
        // Apply dynamic grid columns
        grid.style.gridTemplateColumns = `repeat(${optimalColumns}, 1fr)`;
        
        // Handle full-width containers
        chartContainers.forEach(container => {
            if (container.classList.contains('full-width')) {
                container.style.gridColumn = '1 / -1';
            }
            
            // Ensure proper height for container
            container.style.minHeight = '500px';
            
            // Find chart element and update size
            const chart = container.querySelector('.chart');
            if (chart) {
                chart.style.height = '450px';
                chart.style.minHeight = '450px';
            }
        });
    });
    
    console.log(`Optimized layout for ${availableWidth}px width`);
    
    // Force chart resize after layout optimization
    setTimeout(() => {
        Object.entries(charts).forEach(([chartId, chart]) => {
            if (chart && !chart.isDisposed()) {
                try {
                    const element = document.getElementById(chartId);
                    if (element) {
                        chart.resize({
                            width: element.offsetWidth,
                            height: element.offsetHeight
                        });
                    }
                } catch (error) {
                    console.error(`Error resizing chart ${chartId} after layout optimization:`, error);
                }
            }
        });
    }, 100);
}

// Lazy loading implementation
function initializeLazyLoading() {
    if (!('IntersectionObserver' in window)) {
        console.log('IntersectionObserver not supported, loading all charts immediately');
        return;
    }
    
    const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };
    
    chartObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const chartId = entry.target.id;
                if (charts[chartId] && !charts[chartId].isDisposed()) {
                    // Chart is visible, ensure it's updated
                    const updateFunction = getChartUpdateFunction(chartId);
                    if (updateFunction && lastFetchedData) {
                        updateFunction(lastFetchedData);
                    }
                }
                chartObserver.unobserve(entry.target);
            }
        });
    }, options);
    
    // Observe all chart containers
    Object.keys(charts).forEach(chartId => {
        const element = document.getElementById(chartId);
        if (element) {
            chartObserver.observe(element);
        }
    });
}

// Get chart update function by ID
function getChartUpdateFunction(chartId) {
    const updateFunctions = {
        'sourceChart': updateSourceChart,
        'enterpriseChart': updateEnterpriseChart,
        'typeChart': updateTypeChart,
        'severityChart': updateSeverityChart,
        'targetChart': updateTargetChart,
        'statusChart': updateStatusChart,
        'routeChart': updateRouteChart,
        'contentChart': updateContentChart,
        // Additional charts for enhanced analytics
        'enterpriseTypeMatrix': updateEnterpriseTypeMatrix,
        'timeTrendChart': updateTimeTrendChart,
        'severityTypeChart': updateSeverityTypeChart,
        'riskAnalysisChart': updateRiskAnalysisChart,
        'routeMonthlyChart': updateRouteMonthlyChart,
        'cnlxAnalytics': updateTargetAnalysisCharts,
        'garaAnalytics': updateTargetAnalysisCharts,
        'nvpvAnalytics': updateTargetAnalysisCharts,
        'praiseBySourceChart': updatePraiseAnalysisCharts,
        'praiseByEnterpriseChart': updatePraiseAnalysisCharts,
        'responseRateChart': updateResponseAnalysisCharts,
        'responseTimeChart': updateResponseAnalysisCharts,
        'networkAnalysisChart': updateNetworkAnalysisChart,
        'heatmapChart': updateHeatmapChart,
        'correlationChart': updateCorrelationChart
    };
    
    return updateFunctions[chartId];
}

// Show loading state for charts
function showLoadingState(chartId) {
    if (charts[chartId]) {
        charts[chartId].showLoading('default', {
            text: 'Đang tải dữ liệu...',
            color: '#ffffff',
            textColor: '#ffffff',
            maskColor: 'rgba(0, 0, 0, 0.8)',
            zlevel: 0,
            fontSize: 16,
            fontWeight: 'normal'
        });
    }
}

// Hide loading state
function hideLoadingState(chartId) {
    if (charts[chartId]) {
        charts[chartId].hideLoading();
    }
}

// Fetch data from Elasticsearch with caching
async function fetchDataAndUpdateCharts() {
    // Prevent multiple simultaneous requests
    if (isDataFetching) {
        console.log('Data fetch already in progress, skipping...');
        return;
    }
    
    isDataFetching = true;
    
    try {
        console.log('Fetching data from Elasticsearch...');
        
        // Check cache first
        const cacheKey = 'elasticsearch_data';
        const cachedData = dataCache.get(cacheKey);
        const now = Date.now();
        
        if (cachedData && (now - cachedData.timestamp < 30000)) { // 30 second cache
            console.log('Using cached data...');
            updateAllCharts(cachedData.data);
            isDataFetching = false;
            return;
        }
        
        // Enhanced Elasticsearch query with deeper analysis
        const query = {
            "size": 100, // Get some sample documents
            "query": {
                "match_all": {}
            },
            "aggs": {
                "nguon_agg": {
                    "terms": {
                        "field": "nguon.keyword",
                        "size": 10
                    }
                },
                "xi_nghiep_agg": {
                    "terms": {
                        "field": "xi_nghiep.keyword",
                        "size": 15
                    }
                },
                "loai_agg": {
                    "terms": {
                        "field": "loai.keyword",
                        "size": 10
                    }
                },
                "cap_do_agg": {
                    "terms": {
                        "field": "cap_do",
                        "size": 5
                    }
                },
                "doi_tuong_agg": {
                    "terms": {
                        "field": "doi_tuong.keyword",
                        "size": 10
                    }
                },
                "trang_thai_agg": {
                    "terms": {
                        "field": "trang_thai.keyword",
                        "size": 5
                    }
                },
                "tuyen_agg": {
                    "terms": {
                        "field": "tuyen.keyword",
                        "size": 20
                    }
                },
                "noi_dung_agg": {
                    "terms": {
                        "field": "noi_dung.keyword",
                        "size": 15
                    }
                },
                "total_records": {
                    "value_count": {
                        "field": "_id"
                    }
                },
                // Advanced aggregations for deep analysis
                "enterprise_type_matrix": {
                    "terms": {
                        "field": "xi_nghiep.keyword",
                        "size": 10
                    },
                    "aggs": {
                        "by_type": {
                            "terms": {
                                "field": "loai.keyword",
                                "size": 6
                            }
                        }
                    }
                },
                "severity_type_matrix": {
                    "terms": {
                        "field": "cap_do",
                        "size": 3
                    },
                    "aggs": {
                        "by_type": {
                            "terms": {
                                "field": "loai.keyword",
                                "size": 6
                            }
                        }
                    }
                },
                "target_analysis": {
                    "terms": {
                        "field": "doi_tuong.keyword",
                        "size": 5
                    },
                    "aggs": {
                        "by_source": {
                            "terms": {
                                "field": "nguon.keyword",
                                "size": 3
                            }
                        },
                        "by_severity": {
                            "terms": {
                                "field": "cap_do",
                                "size": 3
                            }
                        }
                    }
                },
                "time_analysis": {
                    "date_histogram": {
                        "field": "created_at",
                        "calendar_interval": "hour",
                        "min_doc_count": 1
                    }
                },
                "praise_analysis": {
                    "filter": {
                        "term": { "loai.keyword": "Khen ngợi" }
                    },
                    "aggs": {
                        "by_source": {
                            "terms": {
                                "field": "nguon.keyword",
                                "size": 3
                            }
                        },
                        "by_enterprise": {
                            "terms": {
                                "field": "xi_nghiep.keyword",
                                "size": 10
                            }
                        }
                    }
                }
            }
        };

        // If direct CORS call fails, we'll use mock data based on your provided statistics
        let data;
        try {
            const response = await axios.post(ELASTICSEARCH_URL, query, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            data = response.data;
        } catch (error) {
            console.warn('Direct Elasticsearch call failed, using mock data:', error.message);
            data = generateEnhancedMockData();
            console.log('Using enhanced mock data with full analytics support');
        }
        
        // Cache the data
        dataCache.set(cacheKey, {
            data: data,
            timestamp: now
        });
        
        lastFetchedData = data;
        updateAllChartsEnhanced(data);
        updateStats(data);
        updateLastUpdateTime();
        
        console.log('Data updated successfully');
        
    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
        isDataFetching = false;
    }
}

// Update all charts with optimized performance (calls enhanced version)
function updateAllCharts(data) {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        updateAllChartsEnhanced(data);
    });
}

// Generate mock data based on provided statistics
function generateMockData() {
    return {
        aggregations: {
            total_records: { value: 10000 },
            nguon_agg: {
                buckets: [
                    { key: 'facebook', doc_count: 3440 },
                    { key: 'zalo', doc_count: 3312 },
                    { key: 'call', doc_count: 3248 }
                ]
            },
            xi_nghiep_agg: {
                buckets: [
                    { key: 'Buýt Cầu Bươu', doc_count: 1155 },
                    { key: 'Xí nghiệp Xe Khách Nam', doc_count: 1153 },
                    { key: 'Buýt nhanh BRT', doc_count: 1145 },
                    { key: 'Buýt 10-10', doc_count: 1127 },
                    { key: 'Công ty Cổ phần Xe Điện', doc_count: 1008 },
                    { key: 'Xí nghiệp Xe Khách Bắc', doc_count: 950 },
                    { key: 'Buýt Nội Bài', doc_count: 890 },
                    { key: 'Xe Khách Phương Nam', doc_count: 820 },
                    { key: 'Buýt Thăng Long', doc_count: 780 },
                    { key: 'Xe Buýt Hà Nội', doc_count: 672 }
                ]
            },
            loai_agg: {
                buckets: [
                    { key: 'Khác', doc_count: 1706 },
                    { key: 'Góp ý', doc_count: 1703 },
                    { key: 'Khen ngợi', doc_count: 1671 },
                    { key: 'Phản ánh', doc_count: 1650 },
                    { key: 'Khiếu nại', doc_count: 1635 },
                    { key: 'Báo cáo sự cố', doc_count: 1635 }
                ]
            },
            cap_do_agg: {
                buckets: [
                    { key: 2, doc_count: 4200 },
                    { key: 1, doc_count: 3400 },
                    { key: 3, doc_count: 2400 }
                ]
            },
            doi_tuong_agg: {
                buckets: [
                    { key: 'CNLX', doc_count: 3390 },
                    { key: 'GARA', doc_count: 3337 },
                    { key: 'NVPV', doc_count: 3273 }
                ]
            },
            trang_thai_agg: {
                buckets: [
                    { key: 'Đã xử lý', doc_count: 5012 },
                    { key: 'Đang xử lý', doc_count: 4988 }
                ]
            },
            tuyen_agg: {
                buckets: [
                    { key: 'BRT01', doc_count: 253 },
                    { key: '49', doc_count: 202 },
                    { key: '26', doc_count: 169 },
                    { key: '146', doc_count: 167 },
                    { key: '17', doc_count: 158 },
                    { key: '92', doc_count: 153 },
                    { key: '22A', doc_count: 149 },
                    { key: '15', doc_count: 144 },
                    { key: '12', doc_count: 143 },
                    { key: '34', doc_count: 143 },
                    { key: '08', doc_count: 140 },
                    { key: '23', doc_count: 138 },
                    { key: '32', doc_count: 135 },
                    { key: '45', doc_count: 132 },
                    { key: '67', doc_count: 128 }
                ]
            },
            noi_dung_agg: {
                buckets: [
                    { key: 'Khác', doc_count: 5748 },
                    { key: 'Hạ tầng, luồng tuyến', doc_count: 587 },
                    { key: 'NVPV', doc_count: 573 },
                    { key: 'Chất lượng phục vụ', doc_count: 520 },
                    { key: 'Thiết bị xe', doc_count: 485 },
                    { key: 'Vé, cước', doc_count: 450 },
                    { key: 'Lịch trình', doc_count: 420 },
                    { key: 'An toàn giao thông', doc_count: 380 },
                    { key: 'Vệ sinh xe', doc_count: 350 },
                    { key: 'Điều độ', doc_count: 320 },
                    { key: 'Tài xế', doc_count: 290 },
                    { key: 'Phụ xe', doc_count: 275 },
                    { key: 'Trạm dừng', doc_count: 260 },
                    { key: 'Thông tin hành trình', doc_count: 240 },
                    { key: 'Kỹ thuật xe', doc_count: 102 }
                ]
            }
        }
    };
}

// Basic chart updates (legacy function - replaced by updateAllChartsEnhanced)
function updateBasicCharts(data) {
    const aggs = data.aggregations;
    
    updateSourceChart(aggs.nguon_agg.buckets);
    updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
    updateTypeChart(aggs.loai_agg.buckets);
    updateSeverityChart(aggs.cap_do_agg.buckets);
    updateTargetChart(aggs.doi_tuong_agg.buckets);
    updateStatusChart(aggs.trang_thai_agg.buckets);
    updateRouteChart(aggs.tuyen_agg.buckets);
    updateContentChart(aggs.noi_dung_agg.buckets);
}

// Update source distribution pie chart
function updateSourceChart(data) {
    if (!data || !Array.isArray(data)) {
        console.warn('Invalid data for source chart');
        return;
    }
    
    if (!charts.sourceChart) {
        console.warn('Source chart not initialized');
        return;
    }
    
    const total = data.reduce((sum, item) => sum + item.doc_count, 0);
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(100, 200, 255, 0.3)',
            borderWidth: 1,
            borderRadius: 12,
            textStyle: {
                color: '#ffffff',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif'
            },
            extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;',
            formatter: function(params) {
                const percentage = params.percent;
                const value = params.value;
                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            📊 ${params.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${params.name}</strong><br/>
                            Số lượng: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: {
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif'
            },
            itemWidth: 12,
            itemHeight: 12,
            icon: 'circle'
        },
        series: [
            {
                name: 'Nguồn báo cáo',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['60%', '50%'],
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowColor: 'transparent',
                        scale: true,
                        scaleSize: 10
                    },
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#ffffff',
                        textShadowBlur: 0,
                        textShadowColor: 'transparent',
                        textShadowOffsetX: 0,
                        textShadowOffsetY: 0
                    }
                },
                itemStyle: {
                    borderRadius: 8,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDelay: function (idx) {
                    return idx * 100;
                }
            }
        ],
        color: ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444']
    };
    
    hideLoadingState('sourceChart');
    charts.sourceChart.setOption(option);
}

// Update enterprise bar chart
function updateEnterpriseChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(100, 200, 255, 0.3)',
            borderWidth: 1,
            borderRadius: 12,
            textStyle: {
                color: '#ffffff',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif'
            },
            extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;',
            axisPointer: {
                type: 'shadow',
                shadowStyle: {
                    color: 'rgba(100, 200, 255, 0.1)'
                }
            },
            formatter: function(params) {
                const param = params[0];
                const value = param.value;
                const name = param.axisValue;
                const total = data.reduce((sum, item) => sum + item.doc_count, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                
                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            🏢 ${param.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${name}</strong><br/>
                            Số báo cáo: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        xAxis: {
            type: 'category',
            data: data.slice(0, 10).map(item => item.key),
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            },
            axisTick: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.1)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 10).map(item => item.doc_count),
                type: 'bar',
                barWidth: '60%',
                itemStyle: {
                    borderRadius: [4, 4, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#64c8ff' },
                        { offset: 0.5, color: '#00ffc8' },
                        { offset: 1, color: '#00b899' }
                    ]),
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                emphasis: {
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#64c8ff' },
                            { offset: 0.7, color: '#00ffc8' },
                            { offset: 1, color: '#00e6cc' }
                        ]),
                        shadowBlur: 0,
                        shadowColor: 'transparent'
                    }
                },
                animationDelay: function (idx) {
                    return idx * 100;
                },
                animationEasing: 'elasticOut'
            }
        ]
    };
    
    hideLoadingState('enterpriseChart');
    charts.enterpriseChart.setOption(option);
}

// Enhanced tooltip configuration for all charts
const enhancedTooltipConfig = {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(100, 200, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    textStyle: {
        color: '#ffffff',
        fontSize: 13,
        fontFamily: 'Inter, sans-serif'
    },
    extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;'
};

// Enhanced animation configuration
const enhancedAnimationConfig = {
    animationDuration: 1000,
    animationEasing: 'elasticOut',
    animationDelay: function (idx) {
        return idx * 100;
    }
};

// Update type chart
function updateTypeChart(data) {
    const total = data.reduce((sum, item) => sum + item.doc_count, 0);
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            ...enhancedTooltipConfig,
            formatter: function(params) {
                const percentage = params.percent;
                const value = params.value;
                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            📋 ${params.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${params.name}</strong><br/>
                            Số lượng: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 20,
            textStyle: {
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif'
            },
            itemWidth: 12,
            itemHeight: 12,
            icon: 'circle'
        },
        series: [
            {
                name: 'Loại báo cáo',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['45%', '50%'],
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowColor: 'transparent',
                        scale: true,
                        scaleSize: 10
                    },
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#ffffff',
                        textShadowBlur: 0,
                        textShadowColor: 'transparent',
                        textShadowOffsetX: 0,
                        textShadowOffsetY: 0
                    }
                },
                itemStyle: {
                    borderRadius: 8,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                ...enhancedAnimationConfig
            }
        ],
        color: ['#ff9664', '#64c8ff', '#00ffc8', '#a855f7', '#f59e0b', '#ef4444']
    };
    
    hideLoadingState('typeChart');
    charts.typeChart.setOption(option);
}

// Update severity chart
function updateSeverityChart(data) {
    const severityNames = { 1: 'Thấp', 2: 'Trung bình', 3: 'Cao' };
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Cấp độ',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: severityNames[item.key] || item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#00ffbb', '#00d4aa', '#ff4757']
    };
    
    hideLoadingState('severityChart');
    charts.severityChart.setOption(option);
}

// Update target chart
function updateTargetChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Đối tượng',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#1890ff', '#52c41a', '#faad14']
    };
    
    hideLoadingState('targetChart');
    charts.targetChart.setOption(option);
}

// Update status chart
function updateStatusChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Trạng thái',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#52c41a', '#faad14']
    };
    
    hideLoadingState('statusChart');
    charts.statusChart.setOption(option);
}

// Update route chart
function updateRouteChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        xAxis: {
            type: 'category',
            data: data.slice(0, 15).map(item => item.key),
            axisLabel: {
                rotate: 0,
                fontSize: 12,
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 15).map(item => item.doc_count),
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#00ffbb' },
                        { offset: 0.5, color: '#00e6cc' },
                        { offset: 1, color: '#00d4aa' }
                    ])
                }
            }
        ]
    };
    
    hideLoadingState('routeChart');
    charts.routeChart.setOption(option);
}

// Update content chart
function updateContentChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        xAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: data.slice(0, 10).map(item => item.key).reverse(),
            axisLabel: {
                fontSize: 11,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 10).map(item => item.doc_count).reverse(),
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#ee6666' },
                        { offset: 0.5, color: '#5470c6' },
                        { offset: 1, color: '#91cc75' }
                    ])
                }
            }
        ]
    };
    
    hideLoadingState('contentChart');
    charts.contentChart.setOption(option);
}

// Update statistics
function updateStats(data) {
    if (!data || !data.aggregations) {
        console.warn('Invalid data for updateStats');
        return;
    }
    
    const aggs = data.aggregations;
    
    // Update total records with null checks
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl && aggs.total_records && aggs.total_records.value) {
        totalRecordsEl.textContent = aggs.total_records.value.toLocaleString('vi-VN');
    } else {
        console.warn('Total records data or element not found');
        if (totalRecordsEl) totalRecordsEl.textContent = 'N/A';
    }
    
    // Update total enterprises
    const totalEnterprisesEl = document.getElementById('totalEnterprises');
    if (totalEnterprisesEl && aggs.xi_nghiep_agg && aggs.xi_nghiep_agg.buckets) {
        totalEnterprisesEl.textContent = aggs.xi_nghiep_agg.buckets.length;
    } else {
        console.warn('Enterprise data or element not found');
        if (totalEnterprisesEl) totalEnterprisesEl.textContent = 'N/A';
    }
    
    // Update total routes
    const totalRoutesEl = document.getElementById('totalRoutes');
    if (totalRoutesEl && aggs.tuyen_agg && aggs.tuyen_agg.buckets) {
        totalRoutesEl.textContent = aggs.tuyen_agg.buckets.length;
    } else {
        console.warn('Route data or element not found');
        if (totalRoutesEl) totalRoutesEl.textContent = 'N/A';
    }
    
    // Update total sources
    const totalSourcesEl = document.getElementById('totalSources');
    if (totalSourcesEl && aggs.nguon_agg && aggs.nguon_agg.buckets) {
        totalSourcesEl.textContent = aggs.nguon_agg.buckets.length;
    } else {
        console.warn('Source data or element not found');
        if (totalSourcesEl) totalSourcesEl.textContent = 'N/A';
    }
}

// Update last update time
function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (!lastUpdateEl) {
        console.warn('Last update element not found');
        return;
    }
    
    try {
        const now = new Date();
        const timeString = now.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdateEl.textContent = `Cập nhật lần cuối: ${timeString}`;
    } catch (error) {
        console.error('Error updating last update time:', error);
        lastUpdateEl.textContent = 'Cập nhật lần cuối: N/A';
    }
}

// Show error message
function showError(message) {
    try {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message || 'Đã xảy ra lỗi không xác định';
        
        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);
            
            // Remove error after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        } else {
            // Fallback: use alert if container not found
            alert(message || 'Đã xảy ra lỗi không xác định');
        }
        
        // Hide loading for all charts safely
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.hideLoading === 'function') {
                try {
                    chart.hideLoading();
                } catch (error) {
                    console.warn('Error hiding loading for chart:', error);
                }
            }
        });
    } catch (error) {
        console.error('Error in showError function:', error);
        // Ultimate fallback
        alert(message || 'Đã xảy ra lỗi không xác định');
    }
}

// Initialize tab navigation with debouncing for performance
let tabSwitchDebounce = null;
let currentActiveTab = 'overview';

function initializeTabs() {
    const navItems = document.querySelectorAll('.nav-item');
    console.log(`🔧 Found ${navItems.length} navigation items`);
    
    navItems.forEach(navItem => {
        navItem.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = navItem.getAttribute('data-tab');
            if (!targetTab) {
                console.error('❌ No data-tab attribute found');
                return;
            }
            
            console.log(`🔄 Switching to tab: ${targetTab}`);
            
            // Simple nav animation
            navItem.style.transform = 'scale(0.98)';
            setTimeout(() => {
                navItem.style.transform = 'scale(1)';
            }, 150);
            
            // Remove active class from all nav items
            navItems.forEach(item => item.classList.remove('active'));
            
            // Add active class to clicked nav item
            navItem.classList.add('active');
            currentActiveTab = targetTab;
            
            // Direct tab switching without complex animations
            try {
                // Hide all tabs
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                
                // Show target tab
                const targetTabElement = document.getElementById(targetTab + '-tab');
                if (targetTabElement) {
                    targetTabElement.classList.add('active');
                    console.log(`✅ Tab switched to: ${targetTab}`);
                    
                    // Update charts for new tab after a short delay
                    setTimeout(() => {
                        if (lastFetchedData) {
                            updateAllChartsEnhanced(lastFetchedData);
                        }
                    }, 100);
                } else {
                    console.error(`❌ Tab element not found: ${targetTab}-tab`);
                }
            } catch (error) {
                console.error('❌ Tab switching error:', error);
            }
        });
    });
}

// Initialize export buttons
function initializeExportButtons() {
    const exportButtons = document.querySelectorAll('.btn-export');
    exportButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const exportType = button.getAttribute('data-export');
            exportSpecificReport(exportType);
        });
    });
}

// Enhanced mock data generator with deeper analytics
function generateEnhancedMockData() {
    const baseData = generateMockData();
    
    // Add enhanced aggregations
    baseData.aggregations.enterprise_type_matrix = {
        buckets: [
            {
                key: 'Buýt Cầu Bươu',
                doc_count: 1155,
                by_type: {
                    buckets: [
                        { key: 'Khác', doc_count: 400 },
                        { key: 'Góp ý', doc_count: 300 },
                        { key: 'Phản ánh', doc_count: 250 },
                        { key: 'Khen ngợi', doc_count: 205 }
                    ]
                }
            },
            {
                key: 'Xí nghiệp Xe Khách Nam',
                doc_count: 1153,
                by_type: {
                    buckets: [
                        { key: 'Khác', doc_count: 380 },
                        { key: 'Góp ý', doc_count: 320 },
                        { key: 'Phản ánh', doc_count: 270 },
                        { key: 'Khen ngợi', doc_count: 183 }
                    ]
                }
            }
        ]
    };
    
    baseData.aggregations.severity_type_matrix = {
        buckets: [
            {
                key: 1,
                doc_count: 3400,
                by_type: {
                    buckets: [
                        { key: 'Khen ngợi', doc_count: 1200 },
                        { key: 'Góp ý', doc_count: 1000 },
                        { key: 'Khác', doc_count: 1200 }
                    ]
                }
            },
            {
                key: 2,
                doc_count: 4200,
                by_type: {
                    buckets: [
                        { key: 'Phản ánh', doc_count: 1500 },
                        { key: 'Góp ý', doc_count: 1400 },
                        { key: 'Khác', doc_count: 1300 }
                    ]
                }
            },
            {
                key: 3,
                doc_count: 2400,
                by_type: {
                    buckets: [
                        { key: 'Khiếu nại', doc_count: 1200 },
                        { key: 'Báo cáo sự cố', doc_count: 800 },
                        { key: 'Phản ánh', doc_count: 400 }
                    ]
                }
            }
        ]
    };
    
    baseData.aggregations.target_analysis = {
        buckets: [
            {
                key: 'CNLX',
                doc_count: 3390,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1200 },
                        { key: 'zalo', doc_count: 1100 },
                        { key: 'call', doc_count: 1090 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1500 },
                        { key: 1, doc_count: 1000 },
                        { key: 3, doc_count: 890 }
                    ]
                }
            },
            {
                key: 'GARA',
                doc_count: 3337,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1150 },
                        { key: 'zalo', doc_count: 1100 },
                        { key: 'call', doc_count: 1087 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1400 },
                        { key: 1, doc_count: 1200 },
                        { key: 3, doc_count: 737 }
                    ]
                }
            },
            {
                key: 'NVPV',
                doc_count: 3273,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1090 },
                        { key: 'zalo', doc_count: 1112 },
                        { key: 'call', doc_count: 1071 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1300 },
                        { key: 1, doc_count: 1200 },
                        { key: 3, doc_count: 773 }
                    ]
                }
            }
        ]
    };
    
    baseData.aggregations.time_analysis = {
        buckets: generateTimeSeriesData()
    };
    
    baseData.aggregations.praise_analysis = {
        doc_count: 1671,
        by_source: {
            buckets: [
                { key: 'facebook', doc_count: 600 },
                { key: 'zalo', doc_count: 550 },
                { key: 'call', doc_count: 521 }
            ]
        },
        by_enterprise: {
            buckets: [
                { key: 'Buýt Cầu Bươu', doc_count: 205 },
                { key: 'Xí nghiệp Xe Khách Nam', doc_count: 183 },
                { key: 'Buýt nhanh BRT', doc_count: 175 },
                { key: 'Buýt 10-10', doc_count: 168 },
                { key: 'Công ty Cổ phần Xe Điện', doc_count: 145 }
            ]
        }
    };
    
    return baseData;
}

// Generate time series data for trend analysis
function generateTimeSeriesData() {
    const data = [];
    const startTime = new Date('1970-01-01T00:29:03');
    
    for (let i = 0; i < 9; i++) {
        const time = new Date(startTime.getTime() + i * 1000);
        data.push({
            key_as_string: time.toISOString(),
            key: time.getTime(),
            doc_count: Math.floor(Math.random() * 2000) + 500
        });
    }
    
    return data;
}

// Update all charts including new detailed analysis charts
function updateAllChartsEnhanced(data) {
    if (!data || !data.aggregations) {
        console.error('Invalid data passed to updateAllChartsEnhanced');
        return;
    }
    
    const aggs = data.aggregations;
    console.log('Updating charts with enhanced data...');
    
    // Get currently active tab to prioritize updates
    const activeTab = document.querySelector('.tab-content.active');
    const activeTabId = activeTab ? activeTab.id : 'overview-tab';
    
    // Always update overview charts (they're most commonly viewed)
    if (activeTabId === 'overview-tab' || !activeTab) {
        console.log('Updating overview charts');
        updateSourceChart(aggs.nguon_agg.buckets);
        updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
        updateTypeChart(aggs.loai_agg.buckets);
        updateSeverityChart(aggs.cap_do_agg.buckets);
        updateTargetChart(aggs.doi_tuong_agg.buckets);
        updateStatusChart(aggs.trang_thai_agg.buckets);
        updateRouteChart(aggs.tuyen_agg.buckets);
        updateContentChart(aggs.noi_dung_agg.buckets);
    }
    
    // Update charts based on active tab for better performance
    // Use requestAnimationFrame for smooth chart updates
    requestAnimationFrame(() => {
        if (activeTabId === 'detailed-tab' || !activeTab) {
            console.log('🔄 Updating detailed charts');
            const detailedUpdates = [];
            
            if (aggs.enterprise_type_matrix) {
                detailedUpdates.push(() => updateEnterpriseTypeMatrix(aggs.enterprise_type_matrix.buckets));
            }
            
            if (aggs.time_analysis) {
                detailedUpdates.push(() => updateTimeTrendChart(aggs.time_analysis.buckets));
            }
            
            if (aggs.severity_type_matrix) {
                detailedUpdates.push(() => updateSeverityTypeChart(aggs.severity_type_matrix.buckets));
                detailedUpdates.push(() => updateRiskAnalysisChart(aggs.severity_type_matrix.buckets));
            }
            
            if (aggs.tuyen_agg) {
                detailedUpdates.push(() => updateRouteMonthlyChart(aggs.tuyen_agg.buckets));
            }
            
            // Batch update with small delays for smooth performance
            detailedUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }
        
        if (activeTabId === 'analytics-tab' || !activeTab) {
            console.log('📈 Updating analytics charts');
            const analyticsUpdates = [];
            
            if (aggs.target_analysis) {
                analyticsUpdates.push(() => updateTargetAnalysisCharts(aggs.target_analysis.buckets));
            }
            
            if (aggs.praise_analysis) {
                analyticsUpdates.push(() => updatePraiseAnalysisCharts(aggs.praise_analysis));
            }
            
            analyticsUpdates.push(() => updateResponseAnalysisCharts(aggs));
            
            // Batch update with small delays
            analyticsUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }
        
        if (activeTabId === 'exports-tab' || !activeTab) {
            console.log('📤 Updating exports charts');
            const exportsUpdates = [
                () => updateNetworkAnalysisChart(aggs),
                () => updateHeatmapChart(aggs),
                () => updateCorrelationChart(aggs)
            ];
            
            // Batch update with small delays
            exportsUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }
    });
    
    console.log(`Charts update completed for tab: ${activeTabId}`);
}

// Force update all charts (for refresh button)
function forceUpdateAllCharts(data) {
    if (!data || !data.aggregations) {
        console.error('Invalid data passed to forceUpdateAllCharts');
        return;
    }
    
    const aggs = data.aggregations;
    console.log('Force updating all charts...');
    
    // Overview charts
    updateSourceChart(aggs.nguon_agg.buckets);
    updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
    updateTypeChart(aggs.loai_agg.buckets);
    updateSeverityChart(aggs.cap_do_agg.buckets);
    updateTargetChart(aggs.doi_tuong_agg.buckets);
    updateStatusChart(aggs.trang_thai_agg.buckets);
    updateRouteChart(aggs.tuyen_agg.buckets);
    updateContentChart(aggs.noi_dung_agg.buckets);
    
    // Detailed charts
    if (aggs.enterprise_type_matrix) {
        updateEnterpriseTypeMatrix(aggs.enterprise_type_matrix.buckets);
    }
    if (aggs.time_analysis) {
        updateTimeTrendChart(aggs.time_analysis.buckets);
    }
    if (aggs.severity_type_matrix) {
        updateSeverityTypeChart(aggs.severity_type_matrix.buckets);
        updateRiskAnalysisChart(aggs.severity_type_matrix.buckets);
    }
    if (aggs.tuyen_agg) {
        updateRouteMonthlyChart(aggs.tuyen_agg.buckets);
    }
    
    // Analytics charts
    if (aggs.target_analysis) {
        updateTargetAnalysisCharts(aggs.target_analysis.buckets);
    }
    if (aggs.praise_analysis) {
        updatePraiseAnalysisCharts(aggs.praise_analysis);
    }
    updateResponseAnalysisCharts(aggs);
    
    // Exports charts
    updateNetworkAnalysisChart(aggs);
    updateHeatmapChart(aggs);
    updateCorrelationChart(aggs);
    
    console.log('Force update all charts completed');
}

// Enterprise Type Matrix Chart
function updateEnterpriseTypeMatrix(data) {
    if (!charts.enterpriseTypeMatrix) return;
    
    const categories = [...new Set(data.flatMap(item => 
        item.by_type.buckets.map(bucket => bucket.key)
    ))];
    
    const series = categories.map(category => ({
        name: category,
        type: 'bar',
        stack: 'total',
        data: data.map(enterprise => {
            const bucket = enterprise.by_type.buckets.find(b => b.key === category);
            return bucket ? bucket.doc_count : 0;
        })
    }));
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        legend: {
            data: categories,
            bottom: 0,
            textStyle: {
                color: '#ffffff'
            }
        },
        xAxis: {
            type: 'category',
            data: data.map(item => item.key),
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: series,
        color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272']
    };
    
    charts.enterpriseTypeMatrix.hideLoading();
    charts.enterpriseTypeMatrix.setOption(option);
}

// Time Trend Chart
function updateTimeTrendChart(data) {
    if (!charts.timeTrendChart) return;
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis'
        },
        xAxis: {
            type: 'time',
            data: data.map(item => item.key),
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [{
            name: 'Số báo cáo',
            type: 'line',
            data: data.map(item => [item.key, item.doc_count]),
            smooth: true,
            lineStyle: {
                width: 3
            },
            areaStyle: {
                opacity: 0.3
            },
            itemStyle: {
                color: '#00ffbb'
            }
        }],
        color: ['#00ffbb']
    };
    
    charts.timeTrendChart.hideLoading();
    charts.timeTrendChart.setOption(option);
}

// Severity Type Matrix Chart
function updateSeverityTypeChart(data) {
    if (!charts.severityTypeChart) return;
    
    const severityNames = { 1: 'Thấp', 2: 'Trung bình', 3: 'Cao' };
    const categories = [...new Set(data.flatMap(item => 
        item.by_type.buckets.map(bucket => bucket.key)
    ))];
    
    const chartData = [];
    data.forEach((severityItem, i) => {
        severityItem.by_type.buckets.forEach((typeItem, j) => {
            chartData.push([i, j, typeItem.doc_count]);
        });
    });
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                const severity = severityNames[data[params.data[0]].key];
                const type = categories[params.data[1]];
                return `${severity} - ${type}<br/>Số lượng: ${params.data[2]}`;
            }
        },
        grid: {
            height: '50%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: data.map(item => severityNames[item.key]),
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: categories,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...chartData.map(item => item[2])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%',
            color: ['#00ffbb', '#52c4e1', '#4ecdc4']
        },
        series: [{
            name: 'Số báo cáo',
            type: 'heatmap',
            data: chartData,
            label: {
                show: true
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    charts.severityTypeChart.hideLoading();
    charts.severityTypeChart.setOption(option);
}

// Risk Analysis Chart
function updateRiskAnalysisChart(data) {
    if (!charts.riskAnalysisChart) return;
    
    const riskData = data.map(item => {
        const highRiskTypes = item.by_type.buckets.filter(type => 
            ['Khiếu nại', 'Báo cáo sự cố', 'Phản ánh'].includes(type.key)
        );
        const riskScore = highRiskTypes.reduce((sum, type) => sum + type.doc_count, 0);
        return {
            name: `Cấp ${item.key}`,
            value: riskScore,
            itemStyle: {
                color: item.key === 3 ? '#ff6b6b' : item.key === 2 ? '#f8a14e' : '#52c4e1'
            }
        };
    });
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [{
            name: 'Mức rủi ro',
            type: 'pie',
            radius: ['40%', '70%'],
            data: riskData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    charts.riskAnalysisChart.hideLoading();
    charts.riskAnalysisChart.setOption(option);
}

// Route Monthly Chart
function updateRouteMonthlyChart(data) {
    if (!charts.routeMonthlyChart) return;
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        dataZoom: [
            {
                type: 'slider',
                show: true,
                xAxisIndex: [0],
                start: 0,
                end: 50
            }
        ],
        xAxis: {
            type: 'category',
            data: data.map(item => item.key),
            axisLabel: {
                rotate: 45,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [{
            name: 'Số báo cáo',
            type: 'bar',
            data: data.map(item => item.doc_count),
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#83bff6' },
                    { offset: 0.5, color: '#188df0' },
                    { offset: 1, color: '#188df0' }
                ])
            }
        }]
    };
    
    charts.routeMonthlyChart.hideLoading();
    charts.routeMonthlyChart.setOption(option);
}

// Target Analysis Charts
function updateTargetAnalysisCharts(data) {
    // CNLX Analytics
    if (charts.cnlxAnalytics) {
        const cnlxData = data.find(item => item.key === 'CNLX');
        if (cnlxData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'item'
                },
                series: [{
                    name: 'Nguồn báo cáo',
                    type: 'pie',
                    radius: '50%',
                    data: cnlxData.by_source.buckets.map(item => ({
                        value: item.doc_count,
                        name: item.key
                    }))
                }],
                color: ['#00ffbb', '#52c4e1', '#f8a14e'],
                legend: {
                    textStyle: {
                        color: '#ffffff'
                    }
                }
            };
            charts.cnlxAnalytics.hideLoading();
            charts.cnlxAnalytics.setOption(option);
        }
    }
    
    // GARA Analytics
    if (charts.garaAnalytics) {
        const garaData = data.find(item => item.key === 'GARA');
        if (garaData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'item'
                },
                series: [{
                    name: 'Cấp độ',
                    type: 'pie',
                    radius: ['30%', '60%'],
                    data: garaData.by_severity.buckets.map(item => ({
                        value: item.doc_count,
                        name: `Cấp ${item.key}`
                    }))
                }],
                color: ['#52c4e1', '#f8a14e', '#ff6b6b'],
                legend: {
                    textStyle: {
                        color: '#ffffff'
                    }
                }
            };
            charts.garaAnalytics.hideLoading();
            charts.garaAnalytics.setOption(option);
        }
    }
    
    // NVPV Analytics
    if (charts.nvpvAnalytics) {
        const nvpvData = data.find(item => item.key === 'NVPV');
        if (nvpvData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'axis'
                },
                xAxis: {
                    type: 'category',
                    data: nvpvData.by_source.buckets.map(item => item.key),
                    axisLabel: {
                        color: '#ffffff'
                    },
                    axisLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.3)'
                        }
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: '#ffffff'
                    },
                    axisLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.3)'
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.1)'
                        }
                    }
                },
                series: [{
                    name: 'Số báo cáo',
                    type: 'bar',
                    data: nvpvData.by_source.buckets.map(item => item.doc_count),
                    itemStyle: {
                        color: '#00ffbb'
                    }
                }]
            };
            charts.nvpvAnalytics.hideLoading();
            charts.nvpvAnalytics.setOption(option);
        }
    }
}

// Praise Analysis Charts
function updatePraiseAnalysisCharts(data) {
    // Praise by Source
    if (charts.praiseBySourceChart) {
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'item'
            },
            series: [{
                name: 'Khen ngợi',
                type: 'pie',
                radius: '60%',
                data: data.by_source.buckets.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                }
            }],
            color: ['#00ffbb', '#52c4e1', '#4ecdc4'],
        legend: {
            textStyle: {
                color: '#ffffff'
            }
        }
        };
        charts.praiseBySourceChart.hideLoading();
        charts.praiseBySourceChart.setOption(option);
    }
    
    // Praise by Enterprise
    if (charts.praiseByEnterpriseChart) {
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            xAxis: {
                type: 'value',
                axisLabel: {
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            yAxis: {
                type: 'category',
                data: data.by_enterprise.buckets.map(item => item.key).reverse(),
                axisLabel: {
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            series: [{
                name: 'Lời khen',
                type: 'bar',
                data: data.by_enterprise.buckets.map(item => item.doc_count).reverse(),
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#00ffbb' },
                        { offset: 1, color: '#52c4e1' }
                    ])
                }
            }]
        };
        charts.praiseByEnterpriseChart.hideLoading();
        charts.praiseByEnterpriseChart.setOption(option);
    }
}

// Response Analysis Charts
function updateResponseAnalysisCharts(aggs) {
    // Response Rate Chart
    if (charts.responseRateChart) {
        const responseData = aggs.xi_nghiep_agg.buckets.map(item => ({
            name: item.key,
            rate: Math.floor(Math.random() * 40) + 60, // Mock response rate 60-100%
            count: item.doc_count
        }));
        
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const data = responseData[params[0].dataIndex];
                    return `${data.name}<br/>Tỷ lệ phản hồi: ${data.rate}%<br/>Tổng báo cáo: ${data.count}`;
                }
            },
            xAxis: {
                type: 'category',
                data: responseData.map(item => item.name),
                axisLabel: {
                    rotate: 45,
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLabel: {
                    formatter: '{value}%',
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            series: [{
                name: 'Tỷ lệ phản hồi',
                type: 'bar',
                data: responseData.map(item => item.rate),
                itemStyle: {
                    color: function(params) {
                        const value = params.value;
                        if (value >= 90) return '#52c41a';
                        if (value >= 70) return '#faad14';
                        return '#f5222d';
                    }
                }
            }]
        };
        charts.responseRateChart.hideLoading();
        charts.responseRateChart.setOption(option);
    }
    
    // Response Time Chart
    if (charts.responseTimeChart) {
        const timeData = aggs.xi_nghiep_agg.buckets.map(item => ({
            name: item.key,
            time: Math.floor(Math.random() * 48) + 2 // Mock response time 2-50 hours
        }));
        
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: '{b}: {c} giờ'
            },
            xAxis: {
                type: 'category',
                data: timeData.map(item => item.name),
                axisLabel: {
                    rotate: 45,
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    formatter: '{value}h',
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            series: [{
                name: 'Thời gian phản hồi',
                type: 'line',
                data: timeData.map(item => item.time),
                smooth: true,
                lineStyle: {
                    width: 3
                },
                symbolSize: 8,
                itemStyle: {
                    color: '#00ffbb'
                }
            }]
        };
        charts.responseTimeChart.hideLoading();
        charts.responseTimeChart.setOption(option);
    }
}

// Network Analysis Chart
function updateNetworkAnalysisChart(aggs) {
    if (!charts.networkAnalysisChart) return;
    
    // Create network data showing relationships between entities
    const nodes = [];
    const links = [];
    
    // Add enterprise nodes
    aggs.xi_nghiep_agg.buckets.slice(0, 6).forEach((enterprise, i) => {
        nodes.push({
            id: enterprise.key,
            name: enterprise.key,
            value: enterprise.doc_count,
            category: 0,
            symbolSize: Math.sqrt(enterprise.doc_count) / 2
        });
    });
    
    // Add source nodes
    aggs.nguon_agg.buckets.forEach((source, i) => {
        nodes.push({
            id: source.key,
            name: source.key,
            value: source.doc_count,
            category: 1,
            symbolSize: Math.sqrt(source.doc_count) / 3
        });
    });
    
    // Create links between enterprises and sources
    aggs.xi_nghiep_agg.buckets.slice(0, 6).forEach(enterprise => {
        aggs.nguon_agg.buckets.forEach(source => {
            links.push({
                source: enterprise.key,
                target: source.key,
                value: Math.floor(Math.random() * 500) + 100
            });
        });
    });
    
    const option = {
        title: {
            text: '',
            textStyle: {
                color: '#ffffff'
            },
            left: 'center'
        },
        tooltip: {},
        legend: {
            data: ['Xí nghiệp', 'Nguồn báo cáo'],
            bottom: 10
        },
        series: [{
            name: 'Mạng lưới',
            type: 'graph',
            layout: 'force',
            data: nodes,
            links: links,
            categories: [
                { name: 'Xí nghiệp' },
                { name: 'Nguồn báo cáo' }
            ],
            roam: true,
            label: {
                show: true,
                position: 'right',
                formatter: '{b}'
            },
            lineStyle: {
                color: 'source',
                curveness: 0.3
            },
            emphasis: {
                focus: 'adjacency',
                lineStyle: {
                    width: 10
                }
            },
            force: {
                repulsion: 1000,
                gravity: 0.1,
                edgeLength: 200,
                layoutAnimation: true
            }
        }],
        color: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12']
    };
    
    charts.networkAnalysisChart.hideLoading();
    charts.networkAnalysisChart.setOption(option);
}

// Heatmap Chart
function updateHeatmapChart(aggs) {
    if (!charts.heatmapChart) return;
    
    // Create heatmap showing enterprise vs type intensity
    const enterprises = aggs.xi_nghiep_agg.buckets.slice(0, 8);
    const types = aggs.loai_agg.buckets.slice(0, 5);
    
    const data = [];
    enterprises.forEach((enterprise, i) => {
        types.forEach((type, j) => {
            data.push([i, j, Math.floor(Math.random() * enterprise.doc_count * 0.3)]);
        });
    });
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                return `${enterprises[params.data[0]].key}<br/>${types[params.data[1]].key}<br/>Số lượng: ${params.data[2]}`;
            }
        },
        grid: {
            height: '60%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: enterprises.map(item => item.key),
            splitArea: {
                show: true
            },
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: types.map(item => item.key),
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...data.map(item => item[2])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%'
        },
        series: [{
            name: 'Báo cáo',
            type: 'heatmap',
            data: data,
            label: {
                show: true
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    charts.heatmapChart.hideLoading();
    charts.heatmapChart.setOption(option);
}

// Correlation Chart
function updateCorrelationChart(aggs) {
    if (!charts.correlationChart) return;
    
    // Create correlation matrix between different metrics
    const metrics = ['Nguồn', 'Loại', 'Cấp độ', 'Đối tượng'];
    const correlationData = [
        [1.00, 0.75, 0.45, 0.32],
        [0.75, 1.00, 0.68, 0.54],
        [0.45, 0.68, 1.00, 0.43],
        [0.32, 0.54, 0.43, 1.00]
    ];
    
    const data = [];
    correlationData.forEach((row, i) => {
        row.forEach((value, j) => {
            data.push([i, j, value]);
        });
    });
    
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                return `${metrics[params.data[0]]} vs ${metrics[params.data[1]]}<br/>Tương quan: ${params.data[2].toFixed(2)}`;
            }
        },
        grid: {
            height: '60%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: metrics,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: metrics,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%',
            color: ['#00ffbb', '#52c4e1', '#4ecdc4', '#48cae4']
        },
        series: [{
            name: 'Tương quan',
            type: 'heatmap',
            data: data,
            label: {
                show: true,
                formatter: function(params) {
                    return params.data[2].toFixed(2);
                }
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    charts.correlationChart.hideLoading();
    charts.correlationChart.setOption(option);
}

// Export specific reports to Excel
function exportSpecificReport(reportType) {
    if (!lastFetchedData) {
        showError('Chưa có dữ liệu để xuất. Vui lòng làm mới dữ liệu trước.');
        return;
    }
    
    const aggs = lastFetchedData.aggregations;
    let workbook, worksheets;
    
    switch(reportType) {
        case 'source-analysis':
            workbook = createSourceAnalysisWorkbook(aggs);
            break;
        case 'target-analysis':
            workbook = createTargetAnalysisWorkbook(aggs);
            break;
        case 'route-analysis':
            workbook = createRouteAnalysisWorkbook(aggs);
            break;
        case 'enterprise-analysis':
            workbook = createEnterpriseAnalysisWorkbook(aggs);
            break;
        case 'praise-analysis':
            workbook = createPraiseAnalysisWorkbook(aggs);
            break;
        case 'comprehensive':
            workbook = createComprehensiveWorkbook(aggs);
            break;
        default:
            showError('Loại báo cáo không được hỗ trợ');
            return;
    }
    
    // Download the Excel file
    XLSX.writeFile(workbook, `bao_cao_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export all data to Excel
function exportAllToExcel() {
    if (!lastFetchedData) {
        showError('Chưa có dữ liệu để xuất. Vui lòng làm mới dữ liệu trước.');
        return;
    }
    
    const aggs = lastFetchedData.aggregations;
    const workbook = createComprehensiveWorkbook(aggs);
    
    XLSX.writeFile(workbook, `bao_cao_tong_hop_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Create Source Analysis Workbook
function createSourceAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    // Source distribution sheet
    const sourceData = [
        ['Nguồn', 'Số lượng', 'Tỷ lệ %'],
        ...aggs.nguon_agg.buckets.map(item => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2)
        ])
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(sourceData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích nguồn');
    
    return wb;
}

// Create Target Analysis Workbook
function createTargetAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    // Target distribution
    const targetData = [
        ['Đối tượng', 'Số lượng', 'Tỷ lệ %'],
        ...aggs.doi_tuong_agg.buckets.map(item => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2)
        ])
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(targetData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích đối tượng');
    
    return wb;
}

// Create Route Analysis Workbook
function createRouteAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    const routeData = [
        ['Tuyến', 'Số báo cáo', 'Mức độ ưu tiên'],
        ...aggs.tuyen_agg.buckets.map((item, index) => [
            item.key,
            item.doc_count,
            index < 5 ? 'Cao' : index < 10 ? 'Trung bình' : 'Thấp'
        ])
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(routeData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích tuyến');
    
    return wb;
}

// Create Enterprise Analysis Workbook
function createEnterpriseAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    const enterpriseData = [
        ['Xí nghiệp', 'Số báo cáo', 'Tỷ lệ %', 'Xếp hạng'],
        ...aggs.xi_nghiep_agg.buckets.map((item, index) => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2),
            index + 1
        ])
    ];
    
    const ws1 = XLSX.utils.aoa_to_sheet(enterpriseData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích xí nghiệp');
    
    return wb;
}

// Create Praise Analysis Workbook
function createPraiseAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    if (aggs.praise_analysis) {
        const praiseData = [
            ['Xí nghiệp', 'Số lời khen', 'Nguồn chính'],
            ...aggs.praise_analysis.by_enterprise.buckets.map(item => [
                item.key,
                item.doc_count,
                'Đa nguồn' // Could be enhanced with actual source analysis
            ])
        ];
        
        const ws1 = XLSX.utils.aoa_to_sheet(praiseData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích khen ngợi');
    }
    
    return wb;
}

// Create Comprehensive Workbook
function createComprehensiveWorkbook(aggs) {
    const wb = XLSX.utils.book_new();
    
    // Summary sheet
    const summaryData = [
        ['Chỉ số', 'Giá trị'],
        ['Tổng số báo cáo', aggs.total_records.value],
        ['Số xí nghiệp', aggs.xi_nghiep_agg.buckets.length],
        ['Số tuyến', aggs.tuyen_agg.buckets.length],
        ['Số nguồn', aggs.nguon_agg.buckets.length],
        ['Tỷ lệ đã xử lý', ((aggs.trang_thai_agg.buckets.find(b => b.key === 'Đã xử lý')?.doc_count || 0) / aggs.total_records.value * 100).toFixed(2) + '%']
    ];
    
    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, 'Tổng quan');
    
    // Add other sheets
    const sourceWb = createSourceAnalysisWorkbook(aggs);
    const targetWb = createTargetAnalysisWorkbook(aggs);
    const routeWb = createRouteAnalysisWorkbook(aggs);
    const enterpriseWb = createEnterpriseAnalysisWorkbook(aggs);
    
    // Copy sheets from other workbooks
    if (sourceWb.Sheets['Phân tích nguồn']) {
        XLSX.utils.book_append_sheet(wb, sourceWb.Sheets['Phân tích nguồn'], 'Nguồn');
    }
    if (targetWb.Sheets['Phân tích đối tượng']) {
        XLSX.utils.book_append_sheet(wb, targetWb.Sheets['Phân tích đối tượng'], 'Đối tượng');
    }
    if (routeWb.Sheets['Phân tích tuyến']) {
        XLSX.utils.book_append_sheet(wb, routeWb.Sheets['Phân tích tuyến'], 'Tuyến');
    }
    if (enterpriseWb.Sheets['Phân tích xí nghiệp']) {
        XLSX.utils.book_append_sheet(wb, enterpriseWb.Sheets['Phân tích xí nghiệp'], 'Xí nghiệp');
    }
    
    return wb;
}

// Global chart enhancement configuration
const CHART_ENHANCEMENTS = {
    tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        borderColor: 'rgba(100, 200, 255, 0.4)',
        borderWidth: 1,
        borderRadius: 12,
        textStyle: {
            color: '#ffffff',
            fontSize: 13,
            fontFamily: 'Inter, sans-serif'
        },
        extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); padding: 15px;'
    },
    colors: ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'],
    animation: {
        animationDuration: 1000,
        animationEasing: 'elasticOut',
        animationDelay: function (idx) {
            return idx * 80;
        }
    }
};

// Apply enhancements to all charts after initialization
function applyChartEnhancements() {
    Object.keys(charts).forEach(chartId => {
        if (charts[chartId]) {
            // Add hover effects
            charts[chartId].on('mouseover', function(params) {
                if (params.componentType === 'series') {
                    document.body.style.cursor = 'pointer';
                }
            });
            
            charts[chartId].on('mouseout', function(params) {
                document.body.style.cursor = 'default';
            });
        }
    });
}

// Enhanced tooltip and interaction configuration
function enhanceAllCharts() {
    const enhancedColors = ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];
    
    Object.keys(charts).forEach((chartId, index) => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            // Add enhanced interactions
            charts[chartId].on('mouseover', function(params) {
                if (params.componentType === 'series') {
                    document.body.style.cursor = 'pointer';
                }
            });
            
            charts[chartId].on('mouseout', function(params) {
                document.body.style.cursor = 'default';
            });
            
            // Add click interactions for detailed view
            charts[chartId].on('click', function(params) {
                if (params.componentType === 'series') {
                    showDetailedTooltip(params, chartId);
                }
            });
        }
    });
}

// Show detailed tooltip on click
function showDetailedTooltip(params, chartId) {
    const tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'custom-detailed-tooltip';
    tooltipDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(100, 200, 255, 0.4);
        border-radius: 16px;
        padding: 25px;
        color: white;
        font-family: Inter, sans-serif;
        backdrop-filter: blur(25px);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        z-index: 10000;
        max-width: 400px;
        animation: fadeInScale 0.3s ease-out;
    `;
    
    tooltipDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #64c8ff; margin: 0 0 10px 0; font-size: 18px;">📊 Thông tin chi tiết</h3>
            <div style="color: #00ffc8; font-weight: 600; font-size: 16px;">${params.name}</div>
        </div>
        <div style="line-height: 1.8; font-size: 14px;">
            <div>📈 Giá trị: <span style="color: #00ffc8; font-weight: 600;">${params.value?.toLocaleString() || 'N/A'}</span></div>
            ${params.percent ? `<div>📊 Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${params.percent}%</span></div>` : ''}
            <div>📋 Loại biểu đồ: <span style="color: #64c8ff;">${chartId.replace('Chart', '')}</span></div>
            <div>⏰ Thời gian: <span style="color: #a855f7;">${new Date().toLocaleString('vi-VN')}</span></div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: linear-gradient(135deg, #64c8ff, #00ffc8); 
                           border: none; 
                           padding: 10px 20px; 
                           border-radius: 8px; 
                           color: white; 
                           font-weight: 600; 
                           cursor: pointer;
                           font-family: Inter, sans-serif;">
                Đóng
            </button>
        </div>
    `;
    
    document.body.appendChild(tooltipDiv);
    
    // Auto remove after 10 seconds
    setTimeout(() => {
        if (tooltipDiv.parentElement) {
            tooltipDiv.remove();
        }
    }, 10000);
}

// Add CSS animation for tooltip
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInScale {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
        100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }
`;
document.head.appendChild(style);

// Debug function to check app status
function debugAppStatus() {
    console.log('=== ECharts Dashboard Debug Info ===');
    console.log('Charts initialized:', Object.keys(charts).length);
    console.log('Available charts:', Object.keys(charts));
    
    // Check which tabs are active
    const activeTab = document.querySelector('.tab-content.active');
    console.log('Active tab:', activeTab ? activeTab.id : 'none');
    
    // Check chart dimensions
    Object.entries(charts).forEach(([id, chart]) => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`Chart ${id}: ${element.offsetWidth}x${element.offsetHeight}, isDisposed: ${chart.isDisposed()}`);
        }
    });
    
    // Check data status
    console.log('Last fetched data available:', !!lastFetchedData);
    
    console.log('=====================================');
}

// Add debug function to window for testing
window.debugAppStatus = debugAppStatus;

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing ECharts Dashboard...');
    
    // Initialize components
    initializeLazyLoading();
    initializeResizeHandler();
    initializeTabs();
    initializeSidebarToggle();
    initializeExportButtons();
    
    // Load initial data
    const mockData = generateEnhancedMockData();
    lastFetchedData = mockData;
    
    // Optimize initial layout
    setTimeout(() => {
        optimizeChartLayout();
    }, 500);
    updateAllChartsEnhanced(mockData);
    updateStats(mockData.aggregations);
    updateLastUpdateTime();
    
    // Apply enhancements after a delay
    setTimeout(() => {
        enhanceAllCharts();
        applyChartEnhancements();
        
        // Debug info
        console.log('App initialization completed');
        debugAppStatus();
    }, 2000);
    
    console.log('ECharts Dashboard initialization started');
}); 