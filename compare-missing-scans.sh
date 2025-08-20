#!/bin/bash

# Extract scan_ids from CSV (excluding header)
echo "Extracting scan_ids from scan_status CSV..."
awk -F',' 'NR>1 {print $2}' /Users/ryanheger/dealbrief-scanner/scan_status_rows-2.csv | sort > /tmp/scan_status_ids.txt

# Create file with all scan_ids from findings (from your query results)
cat > /tmp/findings_scan_ids.txt << 'EOF'
06_-J2-gSMT
09hqXYBuy5v
0U-chkjCjBL
1sc_McjPPfm
_1U1SEs8d9d
2PgGZQ3Q9tu
3IwQTawSjwG
3p_CTGBndG8
3SGBBEAKK63
4oBmVLTZ7de
5_JwuDVjeQx
5tv_b2N_vrf
6Y0KGo8O71M
7JODH7k79DA
7u9lfTiTQ8Z
8TWbjxchs3c
8YcWfZeLoBo
9ak-kfofCaT
9DSx0tVLw_-
9EJwmkWNDCm
9HVFMT0ms-F
9Pzz-2u8Ehp
A2OlrVX7H9E
aFwaXyAMd7A
apt8pZ48DWl
AxbW_1j7bni
b0kRYRqMysT
b1M3jk2UdoE
_b7phcMzWqs
bcJIQcxk8ck
b_DlLAcKtaH
B-oqzPSkbiu
bYjRtzBtse8
c8J2ES2vLKY
CjpIiZQuQWi
cYVDqWcedme
d9y4Xhr746y
DgkbPrPLxl2
_DoJFCs2x5O
dt-vpRJehkG
dUgCbX-MdBF
enjEpUo_OoR
F5BEm0ymCPX
F7HlcZkWWI5
Fir5Sa4QmYq
fUHSYMa9pgD
Fyf1VldrQnh
G24lluo0MIH
G6esKkGYn7s
G--aniX1Gic
gK_MNSzvheA
gUAoNk2rjRT
H22CaG5BRGf
H3RP-mofoJ_
hEi9mNWU6lf
HHQhyW_F09F
hMPlCpEMDA-
HoC4C3jmfYy
HP0n66x4KFC
HqcJ8Tb6Q6z
hu-TUdbc_N1
HxOv8V2c7Pr
I1dlEHOZeUO
I50E5WPlwFQ
I7xzUfCl509
ijiwpwN1W3Q
_iL_f8UF8ab
JiPNfc05oBe
JJbjLUqlVag
jOH_tPjjkdI
JqhVY1LCcdF
k7ZoMrEi_Ef
l2nopZ4o01C
L7KX_KHQDc_
LlW4I89-vWT
_LNL9BxK1mc
M5jptuGjoXo
MHkzJRmaKH5
mswIF86aRHO
ou0E8TcK12R
pFhjL5pzc_k
PGfq0hvchhW
PVfBfu7OVHz
PWlSYuUYkSp
QdVnoU4J2xY
qr3YavtkGl3
QVCrHYPK7wT
RjcYr3zYIbV
rJPmIoaR1E_
rMuXwjrKVXe
rpJ03Kyyspu
s-2ULpPqIJI
SKGRewcisKT
SoEiGGRhR90
t3aQc5LME4G
T8dtgbtEgvL
TguVb_HgDPs
TI1cwtP9O2f
Ti7m-4CfE7p
TIDDyrvMOo1
tSXlMR9RZAO
tYokuldUyG8
u7sah-Tx36T
uCOwEobWIA7
uky5sx2uaKn
V5euZmC_Lou
V6bSZYPXdgR
_VCPDHDxR6L
vEWOvYzfDUo
VreitU5t2kg
VWuyiDA8Z4w
vXN4RpLLuTH
vzrXRWetvGc
W0mqs-3SvKA
wawuQahOOFA
WfK6gEIat7L
wgQ6UuuVMXm
_Wi9pB6oxx5
-WIM2uWCc7z
wPSJUk0ldTs
WXrs8COlUPK
WyuAIiaPERI
XL007eir7Vm
XLKA65ds3J1
xPWPrmB3bSa
xwvZIXOjQf7
XxOiVmf5sz8
yGe9uYb6qyk
YgvqoxIo6Uc
yhIf8b_0_WB
yjL-SVHkNwu
Y_JYyek5sSb
ze0zQDY0dso
ZN6bU5lSFkW
EOF

# Find scan_ids that are in findings but NOT in scan_status
echo -e "\nScan IDs in findings but MISSING from scan_status:"
comm -23 /tmp/findings_scan_ids.txt /tmp/scan_status_ids.txt

# Count the missing scans
echo -e "\nTotal missing scans:"
comm -23 /tmp/findings_scan_ids.txt /tmp/scan_status_ids.txt | wc -l

# Show some stats
echo -e "\nStats:"
echo "Total scan_ids in findings: $(wc -l < /tmp/findings_scan_ids.txt)"
echo "Total scan_ids in scan_status CSV: $(wc -l < /tmp/scan_status_ids.txt)"