import { useEffect, useMemo, useState } from 'react';
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

const DOCUMENT_REQUIREMENTS = [
  { key: 'national_id_url', label: 'National ID / Passport', expiryKey: null, required: true },
  { key: 'license_url', label: 'Driving License', expiryKey: 'license_expiry', required: true },
  { key: 'kra_pin_doc_url', label: 'KRA PIN Copy', expiryKey: null, required: true },
  { key: 'police_clearance_url', label: 'Police Clearance', expiryKey: 'police_clearance_expiry', required: true },
  { key: 'medical_cert_url', label: 'Medical Certificate', expiryKey: 'medical_expiry', required: true },
];

const AGREEMENT_REQUIREMENTS = [
  { key: 'contract_signed', label: 'Driver Contract' },
  { key: 'oath_signed', label: 'Confidentiality Oath' },
  { key: 'sop_signed', label: 'SOP Acceptance' },
];

const formatDate = (value) => {
  if (!value) return 'Not set';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Not set' : parsed.toLocaleString();
};

export default function Compliance() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [complianceData, setComplianceData] = useState(null);
  const [complianceLoading, setComplianceLoading] = useState(false);
  const [complianceError, setComplianceError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionReason, setActionReason] = useState('');
  const [actionError, setActionError] = useState('');
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    if (!user) return;
    const role = user.role?.toLowerCase();
    if (role !== 'super_admin' && role !== 'operations_admin') {
      navigate('/unauthorized');
    }
  }, [navigate, user]);

  useEffect(() => {
    if (user) {
      fetchDrivers();
    }
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.clearTimeout(showToast.timeoutId);
    showToast.timeoutId = window.setTimeout(() => setToast(null), 3200);
  };

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/v1/admin/drivers');
      const nextDrivers = res.data?.data || [];
      setDrivers(nextDrivers);
      if (selectedDriver) {
        const refreshed = nextDrivers.find(driver => driver.id === selectedDriver.id);
        if (refreshed) {
          setSelectedDriver(refreshed);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to load drivers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompliance = async (driverId) => {
    try {
      setComplianceLoading(true);
      setComplianceError(null);
      const res = await api.get(`/api/v1/compliance/drivers/${driverId}`);
      setComplianceData(res.data?.data?.compliance || null);
    } catch (err) {
      setComplianceError(err.response?.data?.error?.message || 'Failed to load compliance data');
      setComplianceData(null);
    } finally {
      setComplianceLoading(false);
    }
  };

  const filteredDrivers = useMemo(() => {
    let nextDrivers = drivers;

    if (filter !== 'all') {
      nextDrivers = nextDrivers.filter(driver => getDriverStatus(driver) === filter);
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      nextDrivers = nextDrivers.filter(driver =>
        getDriverName(driver).toLowerCase().includes(query) ||
        String(driver.license_number || '').toLowerCase().includes(query) ||
        String(driver.user?.phone || driver.phone || '').toLowerCase().includes(query)
      );
    }

    return nextDrivers;
  }, [drivers, filter, search]);

  const selectedDetailStatus = getDriverStatus(selectedDriver);

  const documentChecklist = useMemo(() => {
    return DOCUMENT_REQUIREMENTS.map(doc => ({
      ...doc,
      present: Boolean(complianceData?.[doc.key]),
      expiry: doc.expiryKey ? complianceData?.[doc.expiryKey] : null,
      value: complianceData?.[doc.key],
    }));
  }, [complianceData]);

  const agreementChecklist = useMemo(() => {
    return AGREEMENT_REQUIREMENTS.map(item => ({
      ...item,
      present: Boolean(complianceData?.[item.key]),
    }));
  }, [complianceData]);

  const isReadyForApproval = documentChecklist.every(item => item.present) && agreementChecklist.every(item => item.present);

  const openActionModal = (status, useBulk = false) => {
    setPendingAction(status);
    setBulkMode(useBulk);
    setActionReason('');
    setActionError('');
    setShowActionModal(true);
  };

  const closeActionModal = () => {
    setShowActionModal(false);
    setPendingAction(null);
    setActionReason('');
    setActionError('');
    setBulkMode(false);
  };

  const handleDriverClick = async (driver) => {
    setSelectedDriver(driver);
    await fetchCompliance(driver.id);
  };

  const toggleSelectedDriver = (driverId) => {
    setSelectedDrivers(current =>
      current.includes(driverId)
        ? current.filter(id => id !== driverId)
        : [...current, driverId]
    );
  };

  const submitApproval = async (driverIds) => {
    if (!driverIds.length) return;

    setActionLoading(true);
    try {
      if (driverIds.length === 1) {
        await api.patch(`/api/v1/compliance/drivers/${driverIds[0]}/status`, { status: 'approved' });
      } else {
        await api.patch('/api/v1/compliance/drivers/bulk-status', {
          driver_ids: driverIds,
          status: 'approved',
        });
      }

      showToast(driverIds.length === 1 ? 'Driver approved successfully' : `${driverIds.length} drivers approved`);
      setSelectedDrivers([]);
      await fetchDrivers();
      if (selectedDriver && driverIds.includes(selectedDriver.id)) {
        await fetchCompliance(selectedDriver.id);
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to approve drivers', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const submitActionWithReason = async () => {
    if (!pendingAction) return;

    if (!String(actionReason || '').trim()) {
      setActionError('A reason is required for rejection or resubmission.');
      return;
    }

    const driverIds = bulkMode ? selectedDrivers : selectedDriver ? [selectedDriver.id] : [];
    if (!driverIds.length) return;

    setActionLoading(true);
    setActionError('');

    try {
      if (driverIds.length === 1) {
        await api.patch(`/api/v1/compliance/drivers/${driverIds[0]}/status`, {
          status: pendingAction,
          comment: actionReason.trim(),
        });
      } else {
        await api.patch('/api/v1/compliance/drivers/bulk-status', {
          driver_ids: driverIds,
          status: pendingAction,
          comment: actionReason.trim(),
        });
      }

      showToast(driverIds.length === 1
        ? `Driver marked as ${STATUS_LABELS[pendingAction]}`
        : `${driverIds.length} drivers updated`);

      closeActionModal();
      setSelectedDrivers([]);
      await fetchDrivers();
      if (!bulkMode && selectedDriver) {
        await fetchCompliance(selectedDriver.id);
      }
    } catch (err) {
      showToast(err.response?.data?.error?.message || 'Failed to update compliance status', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const getApprovedBy = (data) => {
    if (!data?.approved_by) return null;
    return data.approved_by_name || data.approved_by?.full_name || `Admin #${data.approved_by}`;
  };

  const getReviewedBy = (data) => {
    if (!data?.status_updated_by) return null;
    return data.status_updated_by_name || data.status_updated_by?.full_name || `Admin #${data.status_updated_by}`;
  };

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Compliance Review</h1>
            <p style={styles.subtitle}>Review driver documents, agreements, and approval readiness.</p>
          </div>
        </div>

        <div style={styles.statsGrid}>
          {[
            { label: 'Total Drivers', value: drivers.length, color: '#3b82f6' },
            { label: 'Pending Review', value: drivers.filter(driver => getDriverStatus(driver) === 'pending').length, color: '#8b5cf6' },
            { label: 'Approved', value: drivers.filter(driver => getDriverStatus(driver) === 'approved').length, color: '#22c55e' },
            { label: 'Rejected / Resubmit', value: drivers.filter(driver => ['rejected', 'resubmission_required'].includes(getDriverStatus(driver))).length, color: '#ef4444' },
          ].map(card => (
            <div key={card.label} style={{ ...styles.statCard, borderColor: card.color }}>
              <div style={{ ...styles.statValue, color: card.color }}>{card.value}</div>
              <div style={styles.statLabel}>{card.label}</div>
            </div>
          ))}
        </div>

        <div style={styles.filterBar}>
          <div style={styles.tabs}>
            {[
              { key: 'all', label: 'All Drivers' },
              { key: 'pending', label: 'Pending Review' },
              { key: 'approved', label: 'Approved' },
              { key: 'rejected', label: 'Rejected' },
              { key: 'resubmission_required', label: 'Resubmission' },
            ].map(tab => (
              <button
                key={tab.key}
                type="button"
                style={{ ...styles.tab, ...(filter === tab.key ? styles.tabActive : {}) }}
                onClick={() => setFilter(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            style={styles.search}
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search driver name, phone, or license"
          />
        </div>

        {selectedDrivers.length > 0 && (
          <div style={styles.bulkBar}>
            <span style={styles.bulkCount}>{selectedDrivers.length} selected</span>
            <div style={styles.bulkActions}>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnApprove, fontSize: 13, padding: '8px 16px' }}
                disabled={actionLoading}
                onClick={() => submitApproval(selectedDrivers)}
              >
                Approve Selected
              </button>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnReject, fontSize: 13, padding: '8px 16px' }}
                disabled={actionLoading}
                onClick={() => openActionModal('rejected', true)}
              >
                Reject Selected
              </button>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnResubmit, fontSize: 13, padding: '8px 16px' }}
                disabled={actionLoading}
                onClick={() => openActionModal('resubmission_required', true)}
              >
                Request Resubmission
              </button>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnSecondary, fontSize: 13, padding: '8px 16px' }}
                onClick={() => setSelectedDrivers([])}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div style={styles.contentGrid}>
          <div style={styles.listPanel}>
            {loading ? (
              <div style={styles.empty}>Loading drivers...</div>
            ) : filteredDrivers.length === 0 ? (
              <div style={styles.empty}>No drivers found.</div>
            ) : (
              filteredDrivers.map(driver => {
                const status = getDriverStatus(driver);
                const style = STATUS_COLORS[status] || STATUS_COLORS.not_submitted;
                const isSelected = selectedDrivers.includes(driver.id);

                return (
                  <button
                    key={driver.id}
                    type="button"
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
                      onChange={(event) => {
                        event.stopPropagation();
                        toggleSelectedDriver(driver.id);
                      }}
                      onClick={event => event.stopPropagation()}
                    />
                    <div style={styles.driverInfo}>
                      <div style={styles.driverName}>{getDriverName(driver)}</div>
                      <div style={styles.driverMeta}>
                        License: {driver.license_number || 'N/A'} | {driver.user?.phone || driver.phone || 'No phone'}
                      </div>
                    </div>
                    <span style={{ ...styles.statusBadge, background: style.bg, color: style.text, border: `1px solid ${style.border}` }}>
                      {STATUS_LABELS[status]}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div style={styles.detailPanel}>
            {!selectedDriver ? (
              <div style={styles.empty}>Select a driver to review compliance.</div>
            ) : complianceLoading ? (
              <div style={styles.empty}>Loading compliance details...</div>
            ) : complianceError ? (
              <div style={styles.errorBox}>
                <div style={styles.errorTitle}>Could not load compliance details</div>
                <div>{complianceError}</div>
                <button type="button" style={{ ...styles.btn, ...styles.btnPrimary, marginTop: 12 }} onClick={() => fetchCompliance(selectedDriver.id)}>
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div style={styles.detailHeader}>
                  <div>
                    <h3 style={styles.detailName}>{getDriverName(selectedDriver)}</h3>
                    <p style={styles.detailMeta}>License: {selectedDriver.license_number || 'N/A'}</p>
                  </div>
                  <span
                    style={{
                      ...styles.statusBadge,
                      background: (STATUS_COLORS[selectedDetailStatus] || STATUS_COLORS.not_submitted).bg,
                      color: (STATUS_COLORS[selectedDetailStatus] || STATUS_COLORS.not_submitted).text,
                      border: `1px solid ${(STATUS_COLORS[selectedDetailStatus] || STATUS_COLORS.not_submitted).border}`,
                      fontSize: 14,
                      padding: '6px 12px',
                    }}
                  >
                    {STATUS_LABELS[selectedDetailStatus]}
                  </span>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitleRow}>
                    <h4 style={styles.sectionTitle}>Required Documents</h4>
                    <span style={{ ...styles.readinessBadge, color: isReadyForApproval ? '#22c55e' : '#f59e0b' }}>
                      {isReadyForApproval ? 'Ready for approval' : 'Missing required items'}
                    </span>
                  </div>
                  <div style={styles.docGrid}>
                    {documentChecklist.map(item => (
                      <div key={item.key} style={styles.docCard}>
                        <div style={styles.docLabel}>{item.label}</div>
                        <div style={styles.docStatus}>
                          <span style={{ color: item.present ? '#22c55e' : '#6b7280' }}>
                            {item.present ? 'Uploaded' : 'Missing'}
                          </span>
                        </div>
                        {item.expiryKey && (
                          <div style={styles.docMeta}>Expiry: {formatDate(item.expiry)}</div>
                        )}
                        {item.present && (
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...styles.btn, ...styles.btnView, marginTop: 8 }}
                            onClick={event => event.stopPropagation()}
                          >
                            View document
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Signed Agreements</h4>
                  <div style={styles.docGrid}>
                    {agreementChecklist.map(item => (
                      <div key={item.key} style={styles.docCard}>
                        <div style={styles.docLabel}>{item.label}</div>
                        <div style={styles.docStatus}>
                          <span style={{ color: item.present ? '#22c55e' : '#6b7280' }}>
                            {item.present ? 'Accepted' : 'Pending'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={styles.section}>
                  <h4 style={styles.sectionTitle}>Compliance Info</h4>
                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Submitted At</span>
                      <span style={styles.infoValue}>{formatDate(complianceData?.submitted_at || complianceData?.created_at)}</span>
                    </div>
                    <div style={styles.infoItem}>
                      <span style={styles.infoLabel}>Reviewed At</span>
                      <span style={styles.infoValue}>{complianceData?.status_updated_at ? formatDate(complianceData.status_updated_at) : 'Pending'}</span>
                    </div>
                    {getApprovedBy(complianceData) && (
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Approved By</span>
                        <span style={{ ...styles.infoValue, color: '#22c55e' }}>{getApprovedBy(complianceData)}</span>
                      </div>
                    )}
                    {getReviewedBy(complianceData) && (
                      <div style={styles.infoItem}>
                        <span style={styles.infoLabel}>Reviewed By</span>
                        <span style={styles.infoValue}>{getReviewedBy(complianceData)}</span>
                      </div>
                    )}
                    {complianceData?.rejection_reason && (
                      <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                        <span style={styles.infoLabel}>Rejection Reason</span>
                        <span style={{ ...styles.infoValue, color: '#ef4444' }}>{complianceData.rejection_reason}</span>
                      </div>
                    )}
                    {complianceData?.resubmission_comment && (
                      <div style={{ ...styles.infoItem, gridColumn: '1 / -1' }}>
                        <span style={styles.infoLabel}>Resubmission Comment</span>
                        <span style={{ ...styles.infoValue, color: '#f59e0b' }}>{complianceData.resubmission_comment}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div style={styles.actions}>
                  <button
                    type="button"
                    style={{ ...styles.btn, ...styles.btnApprove }}
                    disabled={actionLoading || selectedDetailStatus === 'approved' || !isReadyForApproval}
                    title={!isReadyForApproval ? 'All required documents and signed agreements must be complete before approval.' : ''}
                    onClick={() => submitApproval([selectedDriver.id])}
                  >
                    {actionLoading ? 'Processing...' : 'Approve Driver'}
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.btn, ...styles.btnReject }}
                    disabled={actionLoading}
                    onClick={() => openActionModal('rejected')}
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    style={{ ...styles.btn, ...styles.btnResubmit }}
                    disabled={actionLoading}
                    onClick={() => openActionModal('resubmission_required')}
                  >
                    Request Resubmission
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {showActionModal && (
          <div style={styles.modalOverlay} onClick={closeActionModal}>
            <div style={styles.modal} onClick={event => event.stopPropagation()}>
              <h3 style={styles.modalTitle}>
                {bulkMode
                  ? `${pendingAction === 'rejected' ? 'Reject' : 'Request Resubmission for'} ${selectedDrivers.length} Drivers`
                  : pendingAction === 'rejected'
                    ? 'Reject Driver'
                    : 'Request Resubmission'}
              </h3>
              <p style={styles.modalDesc}>
                {pendingAction === 'rejected'
                  ? 'Provide a clear reason that the driver should see in the portal.'
                  : 'Explain what must be corrected before the next review.'}
              </p>
              {actionError && <div style={styles.modalError}>{actionError}</div>}
              <textarea
                style={styles.textarea}
                value={actionReason}
                onChange={event => {
                  setActionReason(event.target.value);
                  setActionError('');
                }}
                rows={4}
                placeholder={pendingAction === 'rejected' ? 'Reason for rejection' : 'Resubmission instructions'}
              />
              <div style={styles.modalActions}>
                <button type="button" style={{ ...styles.btn, ...styles.btnSecondary }} onClick={closeActionModal}>
                  Cancel
                </button>
                <button type="button" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={actionLoading} onClick={submitActionWithReason}>
                  {actionLoading ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {toast && (
          <div style={{ ...styles.toast, ...(toast.type === 'error' ? styles.toastError : styles.toastSuccess) }}>
            {toast.message}
          </div>
        )}
      </div>
    </Layout>
  );
}

function getDriverName(driver) {
  if (!driver) return 'Unknown';
  return driver.user?.full_name || driver.full_name || 'Unknown';
}

function getDriverStatus(driver) {
  if (!driver) return 'not_submitted';
  return driver.user?.compliance_status || driver.compliance_status || 'not_submitted';
}

const styles = {
  container: { padding: '24px 32px', maxWidth: 1440, margin: '0 auto' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#e8eaf2', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#8892a4', margin: 0 },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 24 },
  statCard: {
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: '16px 20px',
  },
  statValue: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.5 },
  filterBar: { display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18 },
  tabs: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  tab: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: '#8892a4',
    fontSize: 13,
    cursor: 'pointer',
  },
  tabActive: {
    background: 'rgba(232,160,32,0.15)',
    borderColor: 'rgba(232,160,32,0.4)',
    color: '#e8a020',
  },
  search: {
    minWidth: 260,
    flex: 1,
    maxWidth: 360,
    background: '#11151f',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '11px 14px',
    color: '#e8eaf2',
    fontSize: 14,
  },
  bulkBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #1a1f2e 0%, #161922 100%)',
    border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: 12,
    padding: '12px 16px',
    marginBottom: 16,
  },
  bulkCount: { fontSize: 14, fontWeight: 600, color: '#60a5fa' },
  bulkActions: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  contentGrid: { display: 'grid', gridTemplateColumns: 'minmax(320px, 440px) minmax(0, 1fr)', gap: 18, alignItems: 'start' },
  listPanel: {
    background: '#141924',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    minHeight: 640,
  },
  detailPanel: {
    position: 'relative',
    background: '#141924',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    minHeight: 640,
  },
  empty: {
    height: '100%',
    minHeight: 240,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#8892a4',
    fontSize: 14,
    textAlign: 'center',
  },
  driverRow: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 14px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 12,
    textAlign: 'left',
    cursor: 'pointer',
    marginBottom: 8,
  },
  driverRowActive: { background: 'rgba(232,160,32,0.08)', borderColor: 'rgba(232,160,32,0.25)' },
  driverRowSelected: { boxShadow: 'inset 0 0 0 1px rgba(59,130,246,0.35)' },
  checkbox: { width: 16, height: 16, cursor: 'pointer' },
  driverInfo: { flex: 1, minWidth: 0 },
  driverName: { color: '#e8eaf2', fontSize: 14, fontWeight: 600, marginBottom: 4 },
  driverMeta: { color: '#8892a4', fontSize: 12 },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  detailHeader: { display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 18 },
  detailName: { color: '#e8eaf2', fontSize: 24, fontWeight: 700, margin: 0 },
  detailMeta: { color: '#8892a4', fontSize: 13, marginTop: 6, marginBottom: 0 },
  section: {
    background: '#101521',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitleRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' },
  sectionTitle: { color: '#e8eaf2', fontSize: 15, fontWeight: 700, margin: 0, marginBottom: 12 },
  readinessBadge: { fontSize: 12, fontWeight: 700 },
  docGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 },
  docCard: {
    background: '#161c29',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    minHeight: 112,
  },
  docLabel: { color: '#e8eaf2', fontSize: 13, fontWeight: 600, marginBottom: 10 },
  docStatus: { fontSize: 13, marginBottom: 8 },
  docMeta: { fontSize: 12, color: '#8892a4' },
  infoGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 },
  infoItem: {
    background: '#161c29',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 14,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  infoLabel: { fontSize: 12, color: '#8892a4', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, color: '#e8eaf2', lineHeight: 1.5 },
  actions: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  btn: {
    border: 'none',
    borderRadius: 10,
    padding: '11px 16px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.2s ease',
  },
  btnPrimary: { background: '#f59e0b', color: '#11151f' },
  btnApprove: { background: '#22c55e', color: '#04140a' },
  btnReject: { background: '#ef4444', color: '#fff5f5' },
  btnResubmit: { background: '#f59e0b', color: '#11151f' },
  btnSecondary: { background: '#1f2937', color: '#e8eaf2', border: '1px solid rgba(255,255,255,0.08)' },
  btnView: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f172a',
    color: '#bfdbfe',
    textDecoration: 'none',
    width: '100%',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.08)',
    border: '1px solid rgba(239,68,68,0.25)',
    borderRadius: 14,
    color: '#fecaca',
    padding: 18,
  },
  errorTitle: { fontWeight: 700, color: '#ef4444', marginBottom: 8 },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(2,6,23,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 50,
  },
  modal: {
    width: '100%',
    maxWidth: 520,
    background: '#111827',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { color: '#e8eaf2', fontSize: 20, fontWeight: 700, margin: 0, marginBottom: 8 },
  modalDesc: { color: '#94a3b8', fontSize: 14, lineHeight: 1.5, marginTop: 0, marginBottom: 12 },
  modalError: { color: '#fca5a5', fontSize: 13, marginBottom: 12 },
  textarea: {
    width: '100%',
    minHeight: 120,
    resize: 'vertical',
    background: '#0f172a',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    color: '#e8eaf2',
    fontSize: 14,
    marginBottom: 16,
  },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap' },
  toast: {
    position: 'fixed',
    right: 20,
    bottom: 20,
    minWidth: 280,
    maxWidth: 420,
    borderRadius: 12,
    padding: '14px 16px',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    zIndex: 60,
    boxShadow: '0 18px 45px rgba(0,0,0,0.3)',
  },
  toastSuccess: { background: '#16a34a' },
  toastError: { background: '#dc2626' },
};
