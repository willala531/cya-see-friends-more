import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Users, Search, Check, Send } from "lucide-react";
import { toast } from "sonner";
import { cyaTransition } from "@/lib/motion";

interface Contact {
  id: string;
  name: string;
  phone: string;
}

const MOCK_CONTACTS: Contact[] = [
  { id: "c1", name: "Jordan Lee", phone: "+1 (555) 234-5678" },
  { id: "c2", name: "Sam Rivera", phone: "+1 (555) 345-6789" },
  { id: "c3", name: "Taylor Kim", phone: "+1 (555) 456-7890" },
  { id: "c4", name: "Morgan Chen", phone: "+1 (555) 567-8901" },
  { id: "c5", name: "Casey Park", phone: "+1 (555) 678-9012" },
  { id: "c6", name: "Riley Johnson", phone: "+1 (555) 789-0123" },
  { id: "c7", name: "Quinn Davis", phone: "+1 (555) 890-1234" },
  { id: "c8", name: "Drew Martinez", phone: "+1 (555) 901-2345" },
];

const CreateGroupPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<"name" | "contacts">("name");
  const [groupName, setGroupName] = useState("");
  const [contactsSynced, setContactsSynced] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filteredContacts = MOCK_CONTACTS.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  const handleSyncContacts = () => {
    setContactsSynced(true);
    toast.success("Contacts synced!");
  };

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSendInvites = () => {
    if (selected.size === 0) {
      toast.error("Select at least one contact");
      return;
    }
    toast.success(`Invites sent to ${selected.size} friend${selected.size > 1 ? "s" : ""}!`);
    navigate("/dashboard");
  };

  return (
    <div className="pb-24 px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => (step === "contacts" ? setStep("name") : navigate("/dashboard"))}
          className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center hover:shadow-gloss-hover transition-shadow"
        >
          <ArrowLeft size={16} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg text-heading">New Group</h1>
          <p className="font-mono-data text-muted-foreground text-[11px]">
            step {step === "name" ? "1" : "2"} of 2
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {step === "name" && (
          <motion.div
            key="name"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={cyaTransition}
          >
            <div className="glass-surface rounded-lg p-5 mb-6">
              <h2 className="font-mono-data text-muted-foreground mb-3">Group Name</h2>
              <input
                type="text"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. Friday Crew, Hiking Pals"
                autoFocus
                className="w-full bg-secondary rounded-md px-3 py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-shadow"
              />
              <p className="text-body text-xs mt-2">
                Pick a name your friends will recognize.
              </p>
            </div>

            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                if (!groupName.trim()) {
                  toast.error("Enter a group name");
                  return;
                }
                setStep("contacts");
              }}
              className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={16} />
            </motion.button>
          </motion.div>
        )}

        {step === "contacts" && (
          <motion.div
            key="contacts"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={cyaTransition}
          >
            {!contactsSynced ? (
              <div className="glass-surface rounded-lg p-6 text-center">
                <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Users size={28} className="text-primary" />
                </div>
                <h2 className="text-base font-medium text-foreground mb-1">
                  Sync your contacts
                </h2>
                <p className="text-body text-xs mb-5">
                  Let cya access your contacts so you can invite friends to{" "}
                  <span className="text-foreground font-medium">{groupName}</span>.
                </p>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSyncContacts}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss flex items-center justify-center gap-2 mb-3"
                >
                  <Users size={16} /> Sync Contacts
                </motion.button>
                <button
                  onClick={() => {
                    setContactsSynced(true);
                  }}
                  className="text-muted-foreground text-xs font-mono-data hover:text-foreground transition-colors"
                >
                  skip — I'll add people later
                </button>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative mb-4">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search contacts..."
                    className="w-full bg-secondary rounded-md pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary transition-shadow"
                  />
                </div>

                {/* Selected count */}
                {selected.size > 0 && (
                  <p className="font-mono-data text-primary text-xs mb-3">
                    {selected.size} selected
                  </p>
                )}

                {/* Contact list */}
                <div className="space-y-2 mb-6 max-h-[340px] overflow-y-auto">
                  {filteredContacts.map((contact, i) => {
                    const isSelected = selected.has(contact.id);
                    return (
                      <motion.button
                        key={contact.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ ...cyaTransition, delay: i * 0.03 }}
                        onClick={() => toggleContact(contact.id)}
                        className={`w-full glass-surface rounded-md p-3 flex items-center justify-between transition-all duration-150 ${
                          isSelected
                            ? "ring-1 ring-primary shadow-gloss"
                            : "hover:shadow-gloss-hover"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-left">
                          <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-medium text-secondary-foreground">
                            {contact.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {contact.name}
                            </p>
                            <p className="font-mono-data text-[10px] text-muted-foreground">
                              {contact.phone}
                            </p>
                          </div>
                        </div>
                        <div
                          className={`w-5 h-5 rounded-sm flex items-center justify-center transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </div>
                      </motion.button>
                    );
                  })}
                  {filteredContacts.length === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-6">
                      No contacts found
                    </p>
                  )}
                </div>

                {/* Send invites */}
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSendInvites}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-gloss flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Send SMS Invites
                </motion.button>
                <button
                  onClick={() => navigate("/dashboard")}
                  className="w-full mt-3 text-muted-foreground text-xs font-mono-data hover:text-foreground transition-colors text-center"
                >
                  skip — I'll invite people later
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CreateGroupPage;
