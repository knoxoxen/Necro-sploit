# Zetasploit LAN Access

This document explains how to make the Zetasploit application accessible from other devices on your local area network (LAN).

## 1. Find Your LAN IP Address

You will need to know the LAN IP address of the computer running Zetasploit. You can find this by running the following command in your terminal:

```bash
ip addr show
```

Look for an entry that starts with `inet` and is followed by an IP address in the format `192.168.x.x`, `10.x.x.x`, or `172.16.x.x` to `172.31.x.x`. This is your LAN IP address.

## 2. Firewall Configuration

By default, your firewall may block incoming connections. You need to allow traffic on the ports that Zetasploit uses. Zetasploit uses port `3000` for the frontend and port `5000` for the backend.

You can use the following commands to allow traffic on these ports using `ufw` (Uncomplicated Firewall), which is common on Debian-based Linux distributions:

```bash
sudo ufw allow 3000/tcp
sudo ufw allow 5000/tcp
sudo ufw reload
```

If you are using a different firewall, you will need to consult its documentation for instructions on how to allow traffic on these ports.

## 3. Start the Application

Once you have configured your firewall, you can start the Zetasploit application as you normally would. The backend and frontend will now be accessible from other devices on your LAN.

## 4. Accessing Zetasploit

To access the Zetasploit application from another device on your LAN, open a web browser and navigate to the following URL, replacing `<your_lan_ip>` with the IP address you found in step 1:

```
http://<your_lan_ip>:3000
```
