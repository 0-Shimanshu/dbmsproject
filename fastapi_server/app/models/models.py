from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="teller")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class AccountHolder(Base):
    __tablename__ = "account_holders"

    holder_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    first_name: Mapped[str] = mapped_column(String(50), nullable=False)
    last_name: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str | None] = mapped_column(String(100), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    date_of_birth: Mapped[Date | None] = mapped_column(Date, nullable=True)
    id_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)


class Account(Base):
    __tablename__ = "accounts"

    account_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    account_number: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    holder_id: Mapped[int] = mapped_column(ForeignKey("account_holders.holder_id"), nullable=False)
    account_type: Mapped[str] = mapped_column(String(30), nullable=False)
    balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    held_balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    freeze_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    frozen_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    frozen_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    interest_rate: Mapped[float] = mapped_column(Numeric(5, 4), nullable=False, default=0)
    overdraft_limit: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False, default=0)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Transaction(Base):
    __tablename__ = "transactions"

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    reference_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    from_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.account_id"), nullable=True)
    to_account_id: Mapped[int | None] = mapped_column(ForeignKey("accounts.account_id"), nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    initiated_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    failure_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PendingApproval(Base):
    __tablename__ = "pending_approvals"

    approval_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.transaction_id"), nullable=False)
    from_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.account_id"), nullable=False)
    to_account_id: Mapped[int] = mapped_column(ForeignKey("accounts.account_id"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    rejection_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Reversal(Base):
    __tablename__ = "reversals"

    reversal_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    original_transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.transaction_id"), nullable=False)
    reversal_transaction_id: Mapped[int | None] = mapped_column(ForeignKey("transactions.transaction_id"), nullable=True)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending")
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.user_id"), nullable=False)
    approved_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    processed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TransactionHistory(Base):
    __tablename__ = "transaction_history"

    history_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_id: Mapped[int] = mapped_column(ForeignKey("transactions.transaction_id"), nullable=False)
    from_state: Mapped[str | None] = mapped_column(String(30), nullable=True)
    to_state: Mapped[str] = mapped_column(String(30), nullable=False)
    changed_by: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.user_id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    old_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    new_values: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SystemConfig(Base):
    __tablename__ = "system_config"

    config_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    config_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    config_value: Mapped[str | None] = mapped_column(Text, nullable=True)
