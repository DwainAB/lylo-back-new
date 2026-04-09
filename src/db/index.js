'use strict';

const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    dialect: 'mysql',
    logging: false,
    pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
  }
);

const Customer = sequelize.define('Customer', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  first_name: { type: DataTypes.STRING(100) },
  last_name: { type: DataTypes.STRING(100) },
  email: { type: DataTypes.STRING(255), unique: true },
  phone: { type: DataTypes.STRING(50) },
  days_available: { type: DataTypes.STRING(50), defaultValue: '0' },
  sessions_available: { type: DataTypes.STRING(50), defaultValue: '0' },
  max_date: { type: DataTypes.DATEONLY, allowNull: true },
}, { tableName: 'customers', timestamps: false });

const TeamMember = sequelize.define('TeamMember', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  first_name: { type: DataTypes.STRING(100) },
  last_name: { type: DataTypes.STRING(100) },
  email: { type: DataTypes.STRING(255), unique: true },
  phone: { type: DataTypes.STRING(50) },
}, { tableName: 'teams', timestamps: false });

// CRUD customers
async function getCustomerByEmail(email) {
  return Customer.findOne({ where: { email } });
}
async function getCustomerById(id) {
  return Customer.findByPk(id);
}
async function getAllCustomers() {
  return Customer.findAll();
}
async function createCustomer(data) {
  return Customer.create(data);
}
async function updateCustomer(id, data) {
  const c = await getCustomerById(id);
  if (!c) return null;
  return c.update(data);
}
async function deleteCustomer(id) {
  const c = await getCustomerById(id);
  if (!c) return false;
  await c.destroy();
  return true;
}

// CRUD teams
async function getTeamMemberByEmail(email) {
  return TeamMember.findOne({ where: { email } });
}
async function getTeamMemberById(id) {
  return TeamMember.findByPk(id);
}
async function getAllTeamMembers() {
  return TeamMember.findAll();
}
async function createTeamMember(data) {
  return TeamMember.create(data);
}
async function updateTeamMember(id, data) {
  const m = await getTeamMemberById(id);
  if (!m) return null;
  return m.update(data);
}
async function deleteTeamMember(id) {
  const m = await getTeamMemberById(id);
  if (!m) return false;
  await m.destroy();
  return true;
}

module.exports = {
  sequelize,
  Customer, TeamMember,
  getCustomerByEmail, getCustomerById, getAllCustomers, createCustomer, updateCustomer, deleteCustomer,
  getTeamMemberByEmail, getTeamMemberById, getAllTeamMembers, createTeamMember, updateTeamMember, deleteTeamMember,
};
