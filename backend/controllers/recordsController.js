// controllers/recordsController.js
const Record = require('../models/Record');
const NodeCache = require('node-cache');
const cache     = new NodeCache({ stdTTL: 30 }); // 30s TTL

// List all records for a patient with caching
exports.getRecords = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const cacheKey = `records_patient_${patientId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const records = await Record.find({ patientId, isDeleted: false })
      .populate('uploadedBy lastUpdatedBy', 'name');
    cache.set(cacheKey, records);

    res.status(200).json(records);
  } catch (err) {
    next(err);
  }
};

// Get one record (optional caching)
exports.getRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const cacheKey = `record_${recordId}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    const record = await Record.findById(recordId);
    if (!record || record.isDeleted) {
      return res.status(404).json({ error: 'Record not found' });
    }
    cache.set(cacheKey, record);

    res.status(200).json(record);
  } catch (err) {
    next(err);
  }
};

exports.createRecord = async (req, res, next) => {
  try {
    const { patientId } = req.params;
    const { title, type, notes } = req.body;
    let fileUrl = null;
    if (req.file && req.file.path) {
      fileUrl = req.file.path;
    }

    const newRec = await Record.create({
      patientId,
      title,
      type,
      notes,
      fileUrl,
      uploadedBy: req.user.id     
    });
    cache.del(`records_patient_${patientId}`); // invalidate list cache

    res.status(201).json(newRec);
  } catch (err) {
    next(err);
  }
};

// Update a record
exports.updateRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const updates = {
      ...req.body,
      lastUpdatedBy: req.user._id
    };

    const updated = await Record.findByIdAndUpdate(
      recordId,
      updates,
      { new: true, runValidators: true }
    );

    if (!updated) return res.status(404).json({ error: 'Record not found' });
    cache.set(`record_${recordId}`, updated);
    cache.del(`records_patient_${updated.patientId}`); // invalidate list cache

    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete a record (soft)
exports.deleteRecord = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const deleted = await Record.findByIdAndUpdate(
      recordId,
      {
        isDeleted: true,
        deletedBy: req.user._id,
        deletedAt: Date.now()
      },
      { new: true }
    );
    if (!deleted) return res.status(404).json({ error: 'Record not found' });
    cache.del(`record_${recordId}`);
    cache.del(`records_patient_${deleted.patientId}`);

    res.status(200).json({ message: 'Record soft-deleted', record: deleted });
  } catch (err) {
    next(err);
  }
};

// Download record file URL
exports.downloadRecordFile = async (req, res, next) => {
  try {
    const { recordId } = req.params;
    const record = await Record.findById(recordId);

    if (!record || record.isDeleted) {
      return res.status(404).json({ error: 'Record not found or deleted' });
    }

    res.json({ fileUrl: record.fileUrl });
  } catch (err) {
    next(err);
  }
};
