from sqlalchemy import create_engine, Column, Integer, String, Boolean, Float, Text, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class Profile(Base):
    __tablename__ = 'profiles'

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(Text, nullable=False, unique=True)
    email = Column(Text)
    user_data = Column(Text)  # JSON for form filling
    settings = Column(Text)  # JSON for profile-specific settings
    is_active = Column(Boolean, default=False)

    opportunities = relationship("Opportunity", back_populates="profile")
    participation_history = relationship("ParticipationHistory", back_populates="profile")


class Opportunity(Base):
    __tablename__ = 'opportunities'

    id = Column(Integer, primary_key=True, autoincrement=True)
    site = Column(Text, nullable=False)
    title = Column(Text, nullable=False)
    description = Column(Text)
    url = Column(Text, nullable=False)
    type = Column(Text)
    priority = Column(Integer)
    value = Column(Float)
    auto_fill = Column(Boolean)
    detected_at = Column(Text, nullable=False)
    expires_at = Column(Text)
    status = Column(Text, default='pending')
    log = Column(Text, default='')
    entries_count = Column(Integer)
    time_left = Column(Text)
    score = Column(Float)
    confirmation_details = Column(Text)
    feedback = Column(Text)
    profile_id = Column(Integer, ForeignKey('profiles.id'))

    profile = relationship("Profile", back_populates="opportunities")
    participation_history = relationship("ParticipationHistory", back_populates="opportunity")


class ParticipationHistory(Base):
    __tablename__ = 'participation_history'

    id = Column(Integer, primary_key=True, autoincrement=True)
    opportunity_id = Column(Integer, ForeignKey('opportunities.id'), nullable=False)
    participation_date = Column(Text, nullable=False)
    status = Column(Text, nullable=False)
    profile_id = Column(Integer, ForeignKey('profiles.id'))

    opportunity = relationship("Opportunity", back_populates="participation_history")
    profile = relationship("Profile", back_populates="participation_history")
