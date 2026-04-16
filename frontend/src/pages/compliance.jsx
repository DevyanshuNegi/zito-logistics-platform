import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/layout';
import api from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

const STATUS_COLORS = {
  approved: { bg: 'rgba(34,197,94,0.15)', text: '#22c55e', border: 'rgba(34,197,94,0.3)' },
  rejected: { bg: 'rgba(239,68,68,0.15)', text: '#ef4444', border: 'rgba(239,68,68,0.3)' },
  resubmission_required: { bg: 'rgba(245,158,11,0.15)', text: '#f59e0b', border: 'rgba(245,158,11,0.3)' },
  pending: { bg: 'rgba(139,92,246,0.15)', text: '#8b5cf6', border: 'rgba(139,92,246,0.3)' },
  not_submitted: { bg: 'rgba(107,114,128,0.15)', text: '#6b7280', border: 'rgba(107,114,128,0.3)' },
};

const STATUS_LABELS = {
  approved: 'Approved',
  rejected: 'Rejected',
  resubmission_required: 'Resubmission Required',
  pending: 'Pending Review',
  not_submitted: 'Not Submitted',
};

export default function Compliance() {
  const navigate = useNavigate();
  const { authUser } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [complianceData, setComplianceData] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [pendingAction, setPendingAction] = useState(null);

  // Bulk selection state (Phase 2: API integration pending)
  const [selectedDrivers, setSelectedDrivers] = useState([]);

  // RBAC: Only admin can access
  useEffect(() => {
    if (!authUser) return;
    const role = authUser.role?.toLowerCase();
    if (role !== 'admin' && role !== 'super_admin') {
      navigate('/unauthorized');
    }
  }, [authUser, navigate]);

  useEffect(() => {
    if (authUser) fetchDrivers();
  }, [authUser]);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/admin/drivers');
      setDrivers(res.data?.data || []);
    } catch (err) {
      showToast('Failed to load drivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompliance = async (driverId) => {
    setComplianceLoading(true);
    setComplianceError(null);
    try {
      const res = await api.get(`/api/v1/compliance/drivers/${driverId}`);
      setComplianceData(res.data?.data?.compliance || null);
    } catch (err) {
      setComplianceError(err.response?.data?.error?.message || 'Failed to load compliance data');
      showToast('Failed to load compliance data', 'error');
    } finally {
      setComplianceLoading(false);
    }
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filteredDrivers = useMemo(() => {
    let result = drivers;
    if (filter !== 'all') {
      result = result.filter(d => {
        const status = d.compliance_status || d.user?.compliance_status || 'not_submitted';
        return status === filter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.full_name || '').toLowerCase().includes(q) ||
        (d.license_number || '').toLowerCase().includes(q) ||
        (d.user?.phone || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [drivers, filter, search]);

  const handleDriverClick = async (driver) => {
    setSelectedDriver(driver);
    setComplianceData(null);
    setComplianceError(null);
    await fetchCompliance(driver.id);
  };

  const getApprovedBy = (data) => {
    if (!data?.approved_by) return null;
    return data.approved_by_name || data.approved_by?.full_name || `Admin #${data.approved_by}`;
  };

  const getStatusUpdatedBy = (data) => {
    if (!data?.status_updated_by) return null;
    return data.status_updated_by_name || data.status_updated_by?.full_name || `Admin #${data.status_updated_by}`;
  };

  // Document keys required for approval
  const REQUIRED_DOCS = ['license', 'psv_badge', 'good_conduct', 'medical', 'ntsa_cert', 'insurance'];

  const areAllDocsUploaded = (data) => {
    if (!data) return false;
    return REQUIRED_DOCS.every(key => data[key]);
  };

  const handleApprove = async () => {
    if (!selectedDriver) return;
    if (!areAllDocsUploaded(complianceData)) {
      showToast('Cannot approve: missing required documents', 'error');
      return;
    }
    setActionLoading(true);
    try {
      await api.put(`/api/v1/compliance/drivers/${selectedDriver.id}/status`, {
        status: 'approved',
      });
      showToast('Driver approved successfully');
      await fetchDrivers();
      await fetchCompliance(selectedDriver.id);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to approve', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectClick = () => {
    setPendingAction('rejected');
    setShowRejectModal(true);
  };

  const handleResubmitClick = () => {
    setPendingAction('resubmission_required');
    setShowRejectModal(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedDriver || !pendingAction) return;
    if (!rejectReason.trim()) {
      setRejectError('Reason is required for rejection/resubmission');
      return;
    }
    setActionLoading(true);
    setRejectError('');
    try {
      await api.put(`/api/v1/compliance/drivers/${selectedDriver.id}/status`, {
        status: pendingAction,
        comment: rejectReason.trim(),
      });
      showToast(`Driver marked as ${STATUS_LABELS[pendingAction]}`);
      setShowRejectModal(false);
      setRejectReason('');
      setPendingAction(null);
      await fetchDrivers();
      await fetchCompliance(selectedDriver.id);
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Normalize driver data (handle inconsistent API structure)
  const getDriverName = (driver) => driver.user?.full_name || driver.full_name || 'Unknown';
  const getDriverPhone = (driver) => driver.user?.phone || driver.phone || 'No phone';
  const getDriverStatus = (driver) => driver.user?.compliance_status || driver.compliance_status || 'not_submitted';

  const getStatusStyle = (status) => STATUS_COLORS[status] || STATUS_COLORS.not_submitted;

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>🛡️ Compliance Review</h1>
          <p style={styles.subtitle}>Review and manage driver compliance documents</p>
        </div>

        {/* Stats */}
        <div style={styles.statsGrid}>
          {[
            { label: 'Total Drivers', value: drivers.length, color: '#3b82f6' },
            { label: 'Pending Review', value: drivers.filter(d => getDriverStatus(d) === 'pending').length, color: '#8b5cf6' },
            { label: 'Approved', value: drivers.filter(d => getDriverStatus(d) === 'approved').length, color: '#22c55e' },
            { label: 'Rejected/Resubmit', value: drivers.filter(d => ['rejected', 'resubmission_required'].includes(getDriverStatus(d))).length, color: '#ef4444' },
          ].map(stat => (
            <div key={stat.label} style={{ ...styles.statCard, borderColor: stat.color }}>
              <div style={{ ...styles.statValue, color: stat.color }}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={styles.filterBar}>
          <div style={styles.tabs}>
            {[
              { key: 'all', label: 'All Drivers' },
              { key: 'pending', label: 'Pending Review' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'resubmission_required', label: 'Resubmission' },
            ].map(t => (
              <button
                key={t.key}
                style={{ ...styles.tab, ...(filter === t.key ? styles.tabActive : {}) }}
                onClick={() => setFilter(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <input
            style={styles.search}
            placeholder="Search driver name, license..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Bulk Action Bar - Phase 2: API integration pending */}
        {selectedDrivers.length > 0 && (
          <div style={styles.bulkBar}>
            <span style={styles.bulkCount}>{selectedDrivers.length} selected</span>
            <div style={styles.bulkActions}>
              <button
                style={{ ...styles.btn, ...styles.btnApprove, fontSize: 13, padding: '8px 16px' }}
                onClick={() => {
                  // TODO: Bulk approve - Phase 2
                  // POST /api/v1/compliance/drivers/bulk-status
                  // { driver_ids: selectedDrivers, status: 'approved' }
                  showToast('Bulk actions coming in Phase 2', 'error');
                }}
              >
                ✓ Approve Selected
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnReject, fontSize: 13, padding: '8px 16px' }}
                onClick={() => {
                  // TODO: Bulk reject - Phase 2
                  showToast('Bulk actions coming in Phase 2', 'error');
                }}
              >
                ✕ Reject Selected
              </button>
              <button
                style={{ ...styles.btn, ...styles.btnSecondary, fontSize: 13, padding: '8px 16px' }}
                onClick={() => setSelectedDrivers([])}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Driver List */}
        <div style={styles.contentGrid}>
          <div style={styles.listPanel}>
            {loading ? (
              <div style={styles.empty}>Loading drivers...</div>
            ) : filteredDrivers.length === 0 ? (
              <div style={styles.empty}>No drivers found</div>
            ) : (
              filteredDrivers.map(driver => {
                const status = getDriverStatus(driver);
                const style = getStatusStyle(status);
                const isSelected = selectedDrivers.includes(driver.id);
                return (
                  <div
                    key={driver.id}
                    style={{
                      ...styles.driverRow,
                      ...(selectedDriver?.id === driver.id ? styles.driverRowActive : {}),
                      ...(isSelected ? styles.driverRowSelected : {}),
                    }}
                    onClick={() => handleDriverClick(driver)}
                  >
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        setSelectedDrivers(prev =>
                          prev.includes(driver.id)
                            ? prev.filter(id => id !== driver.id)
                            : [...prev, driver.id]
                        );
                      }}
                    />
                    <div style={styles.driverInfo}>
                      <div style={styles.driverName}>{getDriverName(driver)}</div>
                      <div style={styles.driverMeta}>
                        License: {driver.license_number || 'N/A'} · {getDriverPhone(driver)}
                      </div>
                    </div>
                    <span style={{ ...styles.statusBadge, background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          {/* Detail Panel */}
          <div style={styles.detailPanel}>
            {!selectedDriver ? (
              <div style={styles.empty}>Select a driver to review compliance</div>
            ) : (
              <>
                {complianceLoading && (
                  <div style={styles.loadingOverlay}>
                    <div style={styles.spinner}>Loading compliance data...</div>
                  </div>
                )}
                {complianceError && (
                  <div style={styles.errorBox}>
                    <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ Error</div>
                    <div>{complianceError}</div>
                    <button style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 12 }} onClick={() => fetchCompliance(selectedDriver.id)}>
                      Retry
                    </button>
                  </div>
                )}
                <div style={styles.detailHeader}>
                  <div>
                    <h3 style={styles.detailName}>{getDriverName(selectedDriver)}</h3>
                    <p style={styles.detailMeta}>License: {selectedDriver.license_number || 'N/A'}</p>
                  </div>
                  {(() => {
                    const status = getDriverStatus(selectedDriver);
                    const style = getStatusStyle(status);
                    return (
                      <span style={{ ...styles.statusBadge, background: style.bg, color: style.text, border: `1px solid ${style.border}`, fontSize: 14, padding: '6px 12px' }}>
                        {STATUS_LABELS[status]}
                      </span>
                    );
                  })()}
                </div>

                {/* Documents Section */}
                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>
                    📋 Documents
                    {complianceData && (
                      <span style={{ fontSize: 12, color: areAllDocsUploaded(complianceData) ? '#22c55e' : '#f59e0b', marginLeft: 12 }}>
                        {areAllDocsUploaded(complianceData) ? '(✓ Complete)' : '(⚠ Incomplete)'}
                      </span>
                    )}
                  </h4>
                  <div style={styles.docGrid}>
                    {[
                      { key: 'license', label: 'Driving License', icon: '🪪' },
                      { key: 'psv_badge', label: 'PSV Badge', icon: '🎫' },
                      { key: 'good_conduct', label: 'Good Conduct', icon: '📄' },
                      { key: 'medical', label: 'Medical Certificate', icon: '🏥' },
                      { key: 'ntsa_cert', label: 'NTSA Certificate', icon: '✅' },
                      { key: 'insurance', label: 'Insurance Copy', icon: '🛡️' },
                    ].map(doc => (
                      <div key={doc.key} style={styles.docCard}>
                        <div style={styles.docIcon}>{doc.icon}</div>
                        <div style={styles.docLabel}>{doc.label}</div>
                        <div style={styles.docStatus}>
                          {complianceData?.[doc.key] ? (
                            <span style={{ color: '#22c55e' }}>✓ Uploaded</span>
                          ) : (
                            <span style={{ color: '#6b7280' }}>— Missing</span>
                          )}
                        </div>
                        {complianceData?.[doc.key] && (
                          <a
                            href={complianceData[doc.key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...styles.btn, ...styles.btnView, marginTop: 8 }}
                            onClick={e => e.stopPropagation()}
                          >
                            👁 View
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Compliance Info */}
                {complianceData && (
                  <div style={styles.section}>
                    <h4 style={styles.sectionTitle}>ℹ️ Compliance Info</h4>
                    <div style={styles.infoGrid}>
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Submitted At</span>
                        <span style={styles.infoValue}>
                          {complianceData.submitted_at ? new Date(complianceData.submitted_at).toLocaleString() : 'N/A'}
                        </span>
                      </div>
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Reviewed At</span>
                        <span style={styles.infoValue}>
                          {complianceData.status_updated_at ? new Date(complianceData.status_updated_at).toLocaleString() : 'Pending'}
                        </span>
                      </div>
                      {complianceData.rejection_reason && (
                        <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                          <span style={styles.infoLabel}>Rejection Reason</span>
                          <span style={{ ...styles.infoValue, color: '#ef4444' }}>{complianceData.rejection_reason}</span>
                        </div>
                      )}
                      {complianceData.resubmission_comment && (
                        <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                          <span style={styles.infoLabel}>Resubmission Comment</span>
                          <span style={{ ...styles.infoValue, color: '#f59e0b' }}>{complianceData.resubmission_comment}</span>
                        </div>
                      )}
                      {getApprovedBy(complianceData) && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Approved By</span>
                          <span style={{ ...styles.infoValue, color: '#22c55e' }}>{getApprovedBy(complianceData)}</span>
                        </div>
                      )}
                      {getStatusUpdatedBy(complianceData) && (
                        <div style={styles.infoItem}>
                          <span style={styles.infoLabel}>Reviewed By</span>
                          <span style={styles.infoValue}>{getStatusUpdatedBy(complianceData)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div style={styles.actions}>
                  <button
                    style={{ ...styles.btn, ...styles.btnApprove }}
                    onClick={handleApprove}
                    disabled={actionLoading || getDriverStatus(selectedDriver) === 'approved' || !areAllDocsUploaded(complianceData)}
                    title={!areAllDocsUploaded(complianceData) ? 'All documents must be uploaded before approval' : ''}
                  >
                    {actionLoading ? 'Processing...' : '✓ Approve Driver'}
                  </button>
                  <button
                    style={{ ...styles.btn, ...styles.btnReject }}
                    onClick={handleRejectClick}
                    disabled={actionLoading}
                  >
                    ✕ Reject
                  </button>
                  <button
                    style={{ ...styles.btn, ...styles.btnResubmit }}
                    onClick={handleResubmitClick}
                    disabled={actionLoading}
                  >
                    ↻ Request Resubmission
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Reject/Resubmit Modal */}
        {showRejectModal && (
          <div style={styles.modalOverlay} onClick={() => setShowRejectModal(false)}>
            <div style={styles.modal} onClick={e => e.stopPropagation()}>
              <h3 style={styles.modalTitle}>
                {pendingAction === 'reject' ? 'Reject Driver' : 'Request Resubmission'}
              </h3>
              <p style={styles.modalDesc}>
                {pendingAction === 'reject'
                  ? 'Please provide a reason for rejecting this driver.'
                  : 'Please specify what documents need to be resubmitted.'}
              </p>
              {rejectError && (
                <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>⚠️ {rejectError}</div>
              )}
              <textarea
                style={styles.textarea}
                placeholder={pendingAction === 'rejected' ? 'Rejection reason (required)...' : 'Resubmission instructions (required)...'}
                value={rejectReason}
                onChange={e => { setRejectReason(e.target.value); setRejectError(''); }}
                rows={4}
              />
              <div style={styles.modalActions}>
                <button style={{ ...styles.btn, ...styles.btnSecondary }} onClick={() => setShowRejectModal(false)}>
                  Cancel
                </button>
                <button
                  style={{ ...styles.btn, ...styles.btnPrimary }}
                  onClick={handleConfirmAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={{ ...styles.toast, ...(toast.type === 'error' ? styles.toastError : styles.toastSuccess) }}>
            {toast.msg}
          </div>
        )}
      </div>
    </Layout>
  );
}

const styles = {
  container: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto' },
  header: { marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#e8eaf2', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#8892a4' },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 },
  statCard: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: '16px 20px',
  },
  statValue: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.5 },

  filterBar: { display: 'flex', gap: 16, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' },
  bulkBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
  },
  bulkCount: { fontSize: 14, fontWeight: 600, color: '#60a5fa' },
  bulkActions: { display: 'flex', gap: 10 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#8892a4',
    fontSize: 13,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    background: 'rgba(232,160,32,0.15)',
    borderColor: 'rgba(232,160,32,0.4)',
    color: '#e8a020',
  },
  search: {
    flex: 1,
    minWidth: 200,
    padding: '10px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#181e2d',
    color: '#e8eaf2',
    fontSize: 14,
  },

  contentGrid: { display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20 },
  listPanel: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    maxHeight: 'calc(100vh - 280px)',
    overflow: 'auto',
  },
  driverRow: {
    padding: '14px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.04)',
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'background 0.2s',
  },
  driverRowActive: {
    background: 'rgba(232,160,32,0.08)',
    borderLeft: '3px solid #e8a020',
  },
  driverRowSelected: {
    background: 'rgba(59,130,246,0.08)',
  },
  checkbox: {
    marginRight: 12,
    width: 18,
    height: 18,
    cursor: 'pointer',
    accentColor: '#e8a020',
  },
  driverInfo: { flex: 1 },
  driverName: { fontWeight: 600, color: '#e8eaf2', fontSize: 14, marginBottom: 2 },
  driverMeta: { fontSize: 12, color: '#8892a4' },
  statusBadge: {
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
  },

  detailPanel: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 24,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  detailName: { fontSize: 20, fontWeight: 700, color: '#e8eaf2', marginBottom: 4 },
  detailMeta: { fontSize: 13, color: '#8892a4' },

  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#e8eaf2', marginBottom: 12 },

  docGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  docCard: {
    background: 'rgba(10,14,23,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 16,
    textAlign: 'center',
  },
  docIcon: { fontSize: 24, marginBottom: 8 },
  docLabel: { fontSize: 12, color: '#8892a4', marginBottom: 4 },
  docStatus: { fontSize: 12, fontWeight: 500 },

  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  infoItem: {
    background: 'rgba(10,14,23,0.5)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: 12,
  },
  infoLabel: { display: 'block', fontSize: 11, color: '#8892a4', marginBottom: 4, textTransform: 'uppercase' },
  infoValue: { fontSize: 14, color: '#e8eaf2', fontWeight: 500 },

  actions: { display: 'flex', gap: 12, marginTop: 24 },
  btn: {
    padding: '12px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    border: 'none',
    transition: 'opacity 0.2s',
  },
  btnApprove: { background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff' },
  btnReject: { background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' },
  btnResubmit: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' },
  btnPrimary: { background: 'linear-gradient(135deg, #e8a020, #d18a0e)', color: '#0a0e17' },
  btnSecondary: { background: 'rgba(255,255,255,0.1)', color: '#e8eaf2' },
  btnView: {
    background: 'rgba(59,130,246,0.15)',
    color: '#60a5fa',
    border: '1px solid rgba(59,130,246,0.3)',
    fontSize: 12,
    padding: '6px 12px',
    textDecoration: 'none',
    display: 'inline-block',
  },

  empty: { padding: 40, textAlign: 'center', color: '#8892a4', fontSize: 14 },

  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(10,14,23,0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    zIndex: 10,
  },
  spinner: { color: '#e8a020', fontSize: 14, fontWeight: 500 },

  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 16,
    color: '#ef4444',
    fontSize: 14,
    marginBottom: 16,
  },

  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 480,
  },
  modalTitle: { fontSize: 18, fontWeight: 700, color: '#e8eaf2', marginBottom: 8 },
  modalDesc: { fontSize: 14, color: '#8892a4', marginBottom: 16 },
  textarea: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: '#0a0e17',
    color: '#e8eaf2',
    fontSize: 14,
    resize: 'vertical',
    marginBottom: 16,
  },
  modalActions: { display: 'flex', gap: 12, justifyContent: 'flex-end' },

  toast: {
    position: 'fixed',
    bottom: 24,
    right: 24,
    padding: '12px 20px',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    zIndex: 1000,
  },
  toastSuccess: { background: 'rgba(34,197,94,0.9)', color: '#fff' },
  toastError: { background: 'rgba(239,68,68,0.9)', color: '#fff' },
};