import React, { useState, useEffect } from 'react';
import { Shield, TrendingUp, AlertCircle, ArrowUpRight, ChevronRight, Info } from 'lucide-react';

// Dummy Data
const companyInfo = {
  company_name: "TechCorp Solutions",
  domain: "techcorp.com",
  scan_date: "2024-01-15",
  scan_id: "scan_abc123"
};

const financialData = {
  eal_low_total: 150000,
  eal_ml_total: 425000,
  eal_high_total: 850000,
  eal_daily_total: 2500,
  overall_risk_score: 72
};

const severityCounts = {
  critical_count: 3,
  high_count: 8,
  medium_count: 15,
  low_count: 22,
  info_count: 12
};

const findingTypes = [
  {
    type: "DENIAL_OF_WALLET",
    display_name: "Cloud Cost Amplification",
    count: 2,
    max_severity: "CRITICAL",
    description: "Vulnerabilities that could lead to massive cloud bills"
  },
  {
    type: "DATA_BREACH_EXPOSURE",
    display_name: "Data Exposure Risk",
    count: 5,
    max_severity: "HIGH",
    description: "Customer data potentially accessible without authorization"
  },
  {
    type: "ADA_LEGAL_CONTINGENT_LIABILITY",
    display_name: "ADA Compliance Gap",
    count: 1,
    max_severity: "MEDIUM",
    description: "Website accessibility issues creating legal liability"
  },
  {
    type: "CLIENT_SIDE_SECRET_EXPOSURE",
    display_name: "Exposed API Keys",
    count: 3,
    max_severity: "HIGH",
    description: "API keys or credentials exposed in client-side code"
  },
  {
    type: "VERIFIED_CVE",
    display_name: "Known Vulnerabilities",
    count: 7,
    max_severity: "CRITICAL",
    description: "Confirmed security vulnerabilities with CVE identifiers"
  }
];

const criticalFindings = [
  {
    id: 1,
    finding_type: "DENIAL_OF_WALLET",
    finding_type_display: "Cloud Cost Amplification",
    severity: "CRITICAL",
    asset_name: "api.techcorp.com",
    description: "Rate limiting bypass allows unlimited API calls",
    eal_ml: 180000,
    remediation_summary: "Implement request throttling and API quotas",
    cve_id: null,
    cvss_score: null
  },
  {
    id: 2,
    finding_type: "VERIFIED_CVE",
    finding_type_display: "WordPress RCE",
    severity: "CRITICAL",
    asset_name: "blog.techcorp.com",
    description: "WordPress plugin vulnerable to remote code execution",
    eal_ml: 95000,
    remediation_summary: "Update to plugin version 2.1.4 immediately",
    cve_id: "CVE-2024-1234",
    cvss_score: 9.8
  },
  {
    id: 3,
    finding_type: "DATA_BREACH_EXPOSURE",
    finding_type_display: "Database Exposure",
    severity: "HIGH",
    asset_name: "admin.techcorp.com",
    description: "Customer database accessible without authentication",
    eal_ml: 150000,
    remediation_summary: "Enable database authentication and IP restrictions",
    cve_id: null,
    cvss_score: null
  }
];

// Utility functions
const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

const formatDate = (dateStr) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Premium Risk Score Visualization
const RiskScoreVisualization = ({ score }) => {
  const [animatedScore, setAnimatedScore] = useState(0);
  
  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);
  
  const getGradient = (score) => {
    if (score <= 30) return 'from-emerald-400 to-teal-500';
    if (score <= 60) return 'from-amber-400 to-orange-500';
    if (score <= 80) return 'from-orange-500 to-red-500';
    return 'from-red-500 to-red-600';
  };
  
  return (
    <div className="relative bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white" />
      
      {/* Main content */}
      <div className="relative p-12">
        <div className="text-center mb-8">
          <h3 className="text-sm font-medium text-gray-500 tracking-wider uppercase">Overall Risk Score</h3>
        </div>
        
        {/* Score display with gradient text - now with subtle container */}
        <div className="relative bg-gray-50/50 rounded-2xl p-8 border border-gray-100">
          <div className={`text-8xl font-thin bg-gradient-to-br ${getGradient(animatedScore)} bg-clip-text text-transparent transition-all duration-1000 text-center`}>
            {animatedScore}
          </div>
          <div className="text-center mt-4">
            <span className="text-gray-600 text-lg">out of 100</span>
          </div>
        </div>
        
        {/* Risk level indicator */}
        <div className="mt-10 flex items-center justify-center">
          <div className="flex items-center gap-3 px-6 py-3 bg-red-50 rounded-full">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <span className="text-red-900 font-medium">High Risk Environment</span>
          </div>
        </div>
        
        {/* Visual risk bar */}
        <div className="mt-8">
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className={`h-full bg-gradient-to-r ${getGradient(animatedScore)} transition-all duration-1000 ease-out rounded-full`}
              style={{ width: `${animatedScore}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Low Risk</span>
            <span>Critical Risk</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Premium Financial Impact Card
const FinancialImpactCard = ({ title, value, subtitle, icon: Icon, trend, emphasis }) => {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 hover:shadow-xl ${
      emphasis ? 'border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50' : 'border-gray-200 bg-white'
    }`}>
      {/* Decorative gradient orb */}
      <div className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${
        emphasis ? 'from-orange-200 to-amber-200' : 'from-gray-100 to-gray-200'
      } rounded-full blur-3xl opacity-50 group-hover:opacity-70 transition-opacity`} />
      
      <div className="relative p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-sm font-medium text-gray-600 uppercase tracking-wider">{title}</p>
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          {Icon && (
            <div className={`p-3 rounded-xl ${
              emphasis ? 'bg-orange-100' : 'bg-gray-100'
            }`}>
              <Icon className={`w-5 h-5 ${emphasis ? 'text-orange-600' : 'text-gray-600'}`} />
            </div>
          )}
        </div>
        
        <div className="flex items-end justify-between">
          <div>
            <div className={`text-4xl font-light ${
              emphasis ? 'text-orange-900' : 'text-gray-900'
            }`}>
              {formatCurrency(value)}
            </div>
          </div>
          {trend && (
            <div className="flex items-center gap-1 text-red-600">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+23%</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sophisticated Severity Distribution
const SeverityDistribution = ({ data }) => {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  const severities = [
    { key: 'critical_count', label: 'Critical', color: 'bg-red-500', lightColor: 'bg-red-100' },
    { key: 'high_count', label: 'High', color: 'bg-orange-500', lightColor: 'bg-orange-100' },
    { key: 'medium_count', label: 'Medium', color: 'bg-amber-500', lightColor: 'bg-amber-100' },
    { key: 'low_count', label: 'Low', color: 'bg-emerald-500', lightColor: 'bg-emerald-100' },
    { key: 'info_count', label: 'Info', color: 'bg-blue-500', lightColor: 'bg-blue-100' },
  ];
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <h3 className="text-lg font-medium text-gray-900 mb-8">Finding Distribution</h3>
      
      {/* Visual bar chart */}
      <div className="space-y-6">
        {severities.map((sev) => {
          const count = data[sev.key];
          const percentage = (count / total) * 100;
          
          return (
            <div key={sev.key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${sev.color}`} />
                  <span className="text-sm font-medium text-gray-700">{sev.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-light text-gray-900">{count}</span>
                  <span className="text-sm text-gray-500">({percentage.toFixed(0)}%)</span>
                </div>
              </div>
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`absolute inset-y-0 left-0 ${sev.color} transition-all duration-1000 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Summary */}
      <div className="mt-8 pt-8 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Total Findings</span>
          <span className="text-3xl font-light text-gray-900">{total}</span>
        </div>
      </div>
    </div>
  );
};

// Premium Category Visualization
const CategoryBreakdown = ({ data }) => {
  const severityGradients = {
    CRITICAL: 'from-red-500 to-red-600',
    HIGH: 'from-orange-500 to-orange-600',
    MEDIUM: 'from-amber-500 to-amber-600',
    LOW: 'from-emerald-500 to-emerald-600',
    INFO: 'from-blue-500 to-blue-600',
  };
  
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-8">
      <h3 className="text-lg font-medium text-gray-900 mb-8">Risk Categories</h3>
      
      <div className="grid grid-cols-1 gap-4">
        {data.map((category, index) => (
          <div 
            key={index}
            className="group relative p-6 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-300 cursor-pointer"
          >
            {/* Background gradient accent */}
            <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${severityGradients[category.max_severity]} rounded-l-xl`} />
            
            <div className="flex items-start justify-between">
              <div className="flex-1 ml-4">
                <h4 className="font-medium text-gray-900 mb-1">{category.display_name}</h4>
                <p className="text-sm text-gray-600 mb-3">{category.description}</p>
                
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${severityGradients[category.max_severity]}`} />
                    <span className="text-xs font-medium text-gray-700">
                      Max: {category.max_severity}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {category.count} {category.count === 1 ? 'finding' : 'findings'}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-center w-16 h-16 bg-gray-50 rounded-xl group-hover:bg-gray-100 transition-colors">
                <span className="text-2xl font-light text-gray-900">{category.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Premium Finding Card
const FindingCard = ({ finding }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const severityColors = {
    CRITICAL: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      text: 'text-red-700',
      badge: 'bg-red-100 text-red-800 border-red-200'
    },
    HIGH: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      text: 'text-orange-700',
      badge: 'bg-orange-100 text-orange-800 border-orange-200'
    },
    MEDIUM: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      text: 'text-amber-700',
      badge: 'bg-amber-100 text-amber-800 border-amber-200'
    }
  };
  
  const colors = severityColors[finding.severity] || severityColors.MEDIUM;
  
  return (
    <div className={`group relative overflow-hidden rounded-2xl border-2 ${colors.border} ${colors.bg} transition-all duration-300`}>
      <div 
        className="p-6 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${colors.badge}`}>
                {finding.severity}
              </span>
              {finding.cve_id && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono bg-gray-100 text-gray-700 border border-gray-200">
                  {finding.cve_id}
                </span>
              )}
            </div>
            <h4 className="text-lg font-medium text-gray-900">{finding.finding_type_display}</h4>
            <p className="text-sm text-gray-600 mt-1">{finding.asset_name}</p>
          </div>
          
          <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
        </div>
        
        {/* Financial Impact */}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-gray-600 mb-1">Potential Annual Loss</p>
            <p className={`text-2xl font-light ${colors.text}`}>{formatCurrency(finding.eal_ml)}</p>
          </div>
          {finding.cvss_score && (
            <div className="text-right">
              <p className="text-sm text-gray-600 mb-1">CVSS Score</p>
              <p className="text-xl font-medium text-gray-900">{finding.cvss_score}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-0 border-t border-gray-200">
          <div className="pt-4 space-y-4">
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Description</h5>
              <p className="text-sm text-gray-600">{finding.description}</p>
            </div>
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">Recommended Action</h5>
              <p className="text-sm text-gray-600">{finding.remediation_summary}</p>
            </div>
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
              View Technical Details
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Main Component
export default function CybersecurityReport() {
  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Premium Header */}
      <header className="bg-white border-b border-gray-200 print:border-gray-300">
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl">
                  <Shield className="w-6 h-6 text-white" />
                </div>
                <h1 className="text-3xl font-light text-gray-900">Security Risk Assessment</h1>
              </div>
              <div className="flex items-center gap-6 text-sm text-gray-600">
                <div>
                  <span className="font-medium">{companyInfo.company_name}</span>
                  <span className="mx-2">•</span>
                  <span>{companyInfo.domain}</span>
                </div>
                <div>
                  <span className="mx-2">•</span>
                  <span>{formatDate(companyInfo.scan_date)}</span>
                </div>
              </div>
            </div>
            
            <div className="print:hidden">
              <button className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Executive Summary Section */}
      <section className="max-w-7xl mx-auto px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Risk Score */}
          <div className="lg:row-span-2">
            <RiskScoreVisualization score={financialData.overall_risk_score} />
          </div>
          
          {/* Financial Impact Grid */}
          <div className="lg:col-span-2 grid grid-cols-2 gap-6">
            <FinancialImpactCard 
              title="Expected Annual Loss"
              value={financialData.eal_ml_total}
              subtitle="Most likely scenario"
              icon={TrendingUp}
              emphasis={true}
              trend={true}
            />
            <FinancialImpactCard 
              title="Daily Risk Exposure"
              value={financialData.eal_daily_total}
              subtitle="Cost per day if exploited"
              icon={AlertCircle}
            />
            <FinancialImpactCard 
              title="Best Case Estimate"
              value={financialData.eal_low_total}
              subtitle="Conservative projection"
            />
            <FinancialImpactCard 
              title="Worst Case Scenario"
              value={financialData.eal_high_total}
              subtitle="Maximum potential impact"
            />
          </div>
        </div>
      </section>

      {/* Findings Analysis */}
      <section className="max-w-7xl mx-auto px-8 py-12">
        <h2 className="text-2xl font-light text-gray-900 mb-8">Security Findings Analysis</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <SeverityDistribution data={severityCounts} />
          <CategoryBreakdown data={findingTypes} />
        </div>
      </section>

      {/* Priority Findings */}
      <section className="max-w-7xl mx-auto px-8 py-12 print:break-before-page">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-light text-gray-900">Priority Findings</h2>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="w-4 h-4" />
            <span>Immediate action required</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-6">
          {criticalFindings.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </div>
      </section>

      {/* Call to Action */}
      <section className="max-w-7xl mx-auto px-8 py-12 print:hidden">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-12 text-white text-center">
          <h3 className="text-2xl font-light mb-4">Ready to Secure Your Infrastructure?</h3>
          <p className="text-gray-300 mb-8 max-w-2xl mx-auto">
            Our security experts are standing by to help you implement these critical fixes and protect your business.
          </p>
          <button className="px-8 py-4 bg-white text-gray-900 rounded-xl hover:bg-gray-100 transition-colors font-medium">
            Schedule Security Review
          </button>
        </div>
      </section>
    </div>
  );
}